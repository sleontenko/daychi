"""Control only this local synthetic fixture, never a deployed environment."""
import argparse
import json
import urllib.request

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('kind', choices=('schedule', 'account'))
parser.add_argument('value')
args = parser.parse_args()
allowed = {'schedule': ('full', 'hide-series', 'empty', 'offline'),
           'account': ('active', 'invalid', 'blocked', 'limited', 'offline')}
if args.value not in allowed[args.kind]: parser.error('Unsupported synthetic mode')
path = '/qa/schedule-mode/' if args.kind == 'schedule' else '/qa/mode/'
request = urllib.request.Request('http://127.0.0.1:8102'+path+args.value, method='POST')
with urllib.request.urlopen(request, timeout=3) as response:
    print(json.dumps(json.load(response)))
