import json

from practice_api.bedrock import BedrockClient


def test_bedrock_answer_maps_only_valid_citations():
    captured = {}

    def fake_converse(**kwargs):
        captured.update(kwargs)
        return {
            "output": {
                "message": {
                    "content": [
                        {
                            "text": json.dumps(
                                {
                                    "answer": "Начните с вводного занятия.",
                                    "citations": [1, 99],
                                },
                                ensure_ascii=False,
                            )
                        }
                    ]
                }
            }
        }

    client = BedrockClient(model="claude-test", converse=fake_converse)
    sources = [
        {
            "id": "one",
            "title": "Вводное занятие",
            "topic_slug": "taiji",
            "kind": "youtube_url",
            "date": "2026-01-01",
        }
    ]

    result = client.answer("С чего начать?", sources)

    assert result["answer"] == "Начните с вводного занятия."
    assert result["citations"] == sources
    assert result["provider"] == "amazon-bedrock"
    assert captured["modelId"] == "claude-test"
