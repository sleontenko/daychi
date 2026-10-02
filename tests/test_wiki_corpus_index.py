from scripts.wiki_corpus_index import Index, classify, resource_links


def test_video_variants_share_key_but_folders_do_not_become_files():
    urls = ['https://youtu.be/abcdefghijk?t=10', 'https://www.youtube.com/watch?v=abcdefghijk&list=abc',
            'https://m.youtube.com/shorts/abcdefghijk', 'https://youtube.com/live/abcdefghijk']
    assert {classify(u)[1] for u in urls} == {'youtube:abcdefghijk'}
    assert classify('https://drive.google.com/drive/folders/test')[0] == 'drive_container'
    assert classify('https://drive.google.com/open?id=test')[1] == 'drive:test'
    assert classify('https://drive.google.com/file/d/test/view')[1] == 'drive:test'
    assert classify('https://youtube.com.attacker.invalid/watch?v=abcdefghijk')[0] == 'other'
    assert classify('https://youtube.com/playlist?list=PLtest')[0] == 'youtube_container'


def test_hidden_link_and_utf16_entity_after_emoji():
    url = 'https://youtu.be/abcdefghijk'
    msg = {'message': '😀 ' + url + ' label', 'entities': [
        {'_': 'MessageEntityUrl', 'offset': 3, 'length': len(url)},
        {'_': 'MessageEntityTextUrl', 'url': 'https://drive.google.com/open?id=test'}]}
    assert {x[1] for x in resource_links(msg)} == {'youtube:abcdefghijk', 'drive:test'}


def test_edit_removes_current_links_preserves_previous_snapshot_and_occurrences(tmp_path):
    db = Index(tmp_path/'test.db')
    db.begin('old','test')
    db.begin('new','test')
    msg = {'id':1,'message':'https://youtu.be/abcdefghijk'}
    db.add('old',10,msg)
    db.add('new',10,msg)
    db.add('new',10,{**msg,'message':'https://drive.google.com/open?id=test'})
    db.add('new',10,{**msg,'id':2})
    db.add('new',20,{**msg,'id':2})
    # Re-run same message does not duplicate occurrence.
    db.add('new',20,{**msg,'id':2})
    assert db.report('old')['unique_resources_by_provider'] == {'youtube':1}
    assert db.report('new')['unique_resources_by_provider'] == {'youtube':1,'drive':1}
    assert db.report('new')['occurrences'] == 3
    assert db.report('new')['messages'] == 3
    db.c.close()


def test_forwarded_same_document_deduplicates_without_losing_messages(tmp_path):
    db = Index(tmp_path/'test.db')
    db.begin('one','test')
    msg = {'id':1,'media':{'document':{'id':55,'mime_type':'video/mp4'}}}
    db.add('one',10,msg)
    db.add('one',20,msg)
    assert db.report('one')['unique_resources_by_provider'] == {'telegram_media':1}
    assert db.report('one')['occurrences'] == 2
    db.c.close()
