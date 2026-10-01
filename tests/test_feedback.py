from uuid import uuid4
from unittest.mock import Mock
import sqlite3
import requests
from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest
from practice_api.feedback import mount_feedback

@pytest.fixture
def relay(tmp_path, monkeypatch):
    monkeypatch.setenv('DAYCHEE_FEEDBACK_BOT_TOKEN', 'test-only')
    monkeypatch.setenv('DAYCHEE_FEEDBACK_CHAT_ID', 'test-chat')
    app=FastAPI(); path=tmp_path/'feedback.sqlite3'; mount_feedback(app,path)
    send=Mock(return_value=Mock(status_code=200,json=lambda: {'ok':True}))
    monkeypatch.setattr('practice_api.feedback.requests.post',send)
    return TestClient(app),send,path

def body():
    return dict(operation_id=str(uuid4()),kind='Ошибка',message='Тест сообщения',contact='',version='1.0')

def test_delivery_and_replay_without_duplicate(relay):
    client,send,path=relay; data=body()
    assert client.post('/api/feedback',json=data).json()=={'status':'sent'}
    assert client.post('/api/feedback',json=data).json()=={'status':'sent'}
    assert send.call_count==1
    assert data['message'] in send.call_args.kwargs['json']['text']
    assert data['message'].encode() not in path.read_bytes()
    data['message']='Другой текст'
    assert client.post('/api/feedback',json=data).status_code==409

def test_timeout_never_claims_success_or_sends_duplicate(relay):
    client,send,_=relay; send.side_effect=requests.Timeout('secret must not escape')
    data=body()
    for _ in range(2):
        result=client.post('/api/feedback',json=data)
        assert result.status_code==503
        assert 'secret' not in result.text
    assert send.call_count==1

def test_rejected_delivery_can_retry_after_backoff(relay):
    client,send,path=relay; send.return_value=Mock(status_code=400,json=lambda:{'ok':False})
    data=body(); assert client.post('/api/feedback',json=data).status_code==503
    assert client.post('/api/feedback',json=data).status_code==429
    with sqlite3.connect(path) as db: db.execute('UPDATE feedback SET created=created-31')
    send.return_value=Mock(status_code=200,json=lambda:{'ok':True})
    assert client.post('/api/feedback',json=data).status_code==200

def test_validation_limit_and_missing_configuration(relay,monkeypatch):
    client,send,_=relay
    data=body();data['message']='  '
    assert client.post('/api/feedback',json=data).status_code==422
    assert client.post('/api/feedback',json=body(),headers={'Origin':'https://evil.test'}).status_code==403
    for _ in range(5): assert client.post('/api/feedback',json=body()).status_code==200
    assert client.post('/api/feedback',json=body()).status_code==429
    monkeypatch.delenv('DAYCHEE_FEEDBACK_BOT_TOKEN')
    assert client.post('/api/feedback',json=body()).status_code==503
    assert send.call_count==5

def test_large_body_is_rejected_before_delivery(relay):
    client,send,_=relay
    result=client.post('/api/feedback',content=b' '*17000,headers={'Content-Type':'application/json'})
    assert result.status_code==413
    send.assert_not_called()
