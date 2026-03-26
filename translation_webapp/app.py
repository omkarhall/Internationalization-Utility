from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.requests import Request
import csv
import io
import json
import os
import zipfile
from typing import Dict, List, Any

app = FastAPI(title="Translation Utility Web App")
app.mount('/static', StaticFiles(directory='static'), name='static')
templates = Jinja2Templates(directory='templates')


def flatten_dict(d: Dict[str, Any], parent_key: str = '', sep: str = '.') -> Dict[str, Any]:
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        else:
            items.append((new_key, v))
    return dict(items)


def unflatten_dict(flat: Dict[str, Any], sep: str = '.') -> Dict[str, Any]:
    result: Dict[str, Any] = {}
    for compound_key, value in flat.items():
        keys = compound_key.split(sep)
        current = result
        for key in keys[:-1]:
            if key not in current or not isinstance(current[key], dict):
                current[key] = {}
            current = current[key]
        current[keys[-1]] = value
    return result


@app.get('/', response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse('index.html', {'request': request})


@app.post('/api/json-to-csv')
async def json_to_csv(files: List[UploadFile] = File(...), preserve_order: bool = Form(True)):
    if not files:
        raise HTTPException(status_code=400, detail='Please upload at least one JSON file.')

    flattened_data = []
    all_keys = []
    seen_keys = set()

    for upload in files:
        if not upload.filename.lower().endswith('.json'):
            raise HTTPException(status_code=400, detail=f'{upload.filename} is not a JSON file.')
        content = await upload.read()
        try:
            data = json.loads(content.decode('utf-8'))
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail=f'{upload.filename} contains invalid JSON.')

        flattened = flatten_dict(data)
        flattened_data.append((os.path.splitext(upload.filename)[0], flattened))

        if preserve_order:
            for key in flattened.keys():
                if key not in seen_keys:
                    seen_keys.add(key)
                    all_keys.append(key)
        else:
            seen_keys.update(flattened.keys())

    if not preserve_order:
        all_keys = sorted(seen_keys)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Key'] + [name for name, _ in flattened_data])

    for key in all_keys:
        row = [key] + [flattened.get(key, '') for _, flattened in flattened_data]
        writer.writerow(row)

    csv_bytes = io.BytesIO(output.getvalue().encode('utf-8-sig'))
    headers = {'Content-Disposition': 'attachment; filename=merged_output.csv'}
    return StreamingResponse(csv_bytes, media_type='text/csv', headers=headers)


@app.post('/api/csv-to-json')
async def csv_to_json(file: UploadFile = File(...)):
    if not file.filename.lower().endswith('.csv'):
        raise HTTPException(status_code=400, detail='Please upload a CSV file.')

    content = await file.read()
    try:
        text = content.decode('utf-8-sig')
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail='CSV must be UTF-8 encoded.')

    reader = csv.reader(io.StringIO(text))
    try:
        header = next(reader)
    except StopIteration:
        raise HTTPException(status_code=400, detail='CSV is empty.')

    if len(header) < 2 or header[0] != 'Key':
        raise HTTPException(status_code=400, detail="CSV must start with a 'Key' column followed by language columns.")

    language_columns = header[1:]
    flat_maps = {language: {} for language in language_columns}

    for row_num, row in enumerate(reader, start=2):
        if not row:
            continue
        if len(row) < len(header):
            row += [''] * (len(header) - len(row))
        key = row[0].strip()
        if not key:
            continue
        for i, language in enumerate(language_columns, start=1):
            flat_maps[language][key] = row[i]

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, mode='w', compression=zipfile.ZIP_DEFLATED) as zf:
        for language, flat_map in flat_maps.items():
            nested_json = unflatten_dict(flat_map)
            zf.writestr(f'{language}.json', json.dumps(nested_json, indent=2, ensure_ascii=False))

    zip_buffer.seek(0)
    headers = {'Content-Disposition': 'attachment; filename=translated_json_files.zip'}
    return StreamingResponse(zip_buffer, media_type='application/zip', headers=headers)
