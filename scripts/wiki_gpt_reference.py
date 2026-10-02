"""Bounded OpenAI audio pilot; machine reference, never marked human-verified."""
import argparse
import hashlib
import json
from pathlib import Path
import time
import urllib.error
import urllib.request
import uuid

from dotenv import dotenv_values


def run(root, env_file):
    clips = json.loads((root / 'manifest.json').read_text())['clips']
    if sum(c['seconds'] for c in clips) > 480:
        raise ValueError('This pilot is capped at eight minutes including silence')
    key = dotenv_values(env_file).get('OPENAI_API_KEY')
    if not key or not key.startswith('sk-'):
        raise ValueError('Missing API key')
    output = root / 'gpt-transcribe'
    output.mkdir(exist_ok=True)
    settings = {'model': 'gpt-transcribe'}
    for clip in clips:
        audio = Path(clip['path']).read_bytes()
        if hashlib.sha256(audio).hexdigest() != clip['sha256']:
            raise ValueError('Audio hash mismatch')
        target = output / (clip['id'] + '.json')
        if target.exists():
            saved = json.loads(target.read_text())
            if saved['audio_sha256'] != clip['sha256'] or saved['settings'] != settings:
                raise ValueError('Cached result mismatch')
            print(clip['id'], 'cached', flush=True)
            continue
        boundary = uuid.uuid4().hex
        body = (f'--{boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\ngpt-transcribe\r\n'
                f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="clip.wav"\r\n'
                'Content-Type: audio/wav\r\n\r\n').encode() + audio + f'\r\n--{boundary}--\r\n'.encode()
        request = urllib.request.Request('https://api.openai.com/v1/audio/transcriptions', data=body,
            headers={'Authorization': 'Bearer ' + key,
                     'Content-Type': 'multipart/form-data; boundary=' + boundary})
        start = time.monotonic()
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                payload = json.load(response)
                request_id = response.headers.get('x-request-id')
        except urllib.error.HTTPError as error:
            try:
                code = json.load(error).get('error', {}).get('code')
            except Exception:
                code = None
            raise RuntimeError(f'OpenAI HTTP {error.code}; error_code={code}; no automatic retry') from None
        except urllib.error.URLError:
            raise RuntimeError('OpenAI network error; no automatic retry') from None
        if not isinstance(payload.get('text'), str):
            raise ValueError('API response lacks transcript')
        result = {'clip_id': clip['id'], 'audio_sha256': clip['sha256'], 'seconds': clip['seconds'],
                  'settings': settings, 'text': payload['text'], 'raw_response': payload,
                  'elapsed_seconds': time.monotonic() - start, 'request_id': request_id,
                  'reference_kind': 'single_model_machine_reference', 'verified_by_listener': False,
                  'estimated_usd': clip['seconds'] / 60 * 0.0045}
        temporary = target.with_suffix('.tmp')
        temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
        temporary.replace(target)
        print(clip['id'], 'saved', round(result['elapsed_seconds'], 1), 'seconds', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--env-file', type=Path, required=True)
    args = parser.parse_args()
    run(args.root, args.env_file)
