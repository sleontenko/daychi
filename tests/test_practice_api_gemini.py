import json

from practice_api.gemini import GeminiClient


class FakeResponse:
    def raise_for_status(self):
        return None

    def json(self):
        return {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": json.dumps(
                                    {
                                        "answer": "Начните с первого урока.",
                                        "citations": [1, 99],
                                    },
                                    ensure_ascii=False,
                                )
                            }
                        ]
                    }
                }
            ]
        }


def test_gemini_answer_maps_only_valid_citations():
    captured = {}

    def fake_post(url, **kwargs):
        captured["url"] = url
        captured["headers"] = kwargs["headers"]
        return FakeResponse()

    client = GeminiClient("secret-test-key", "gemini-test", post=fake_post)
    sources = [
        {
            "id": "one",
            "title": "Первый урок",
            "topic_slug": "taiji",
            "kind": "youtube_url",
            "date": "2026-01-01",
        }
    ]

    result = client.answer("С чего начать?", sources)

    assert result["answer"] == "Начните с первого урока."
    assert result["citations"] == sources
    assert captured["headers"] == {"x-goog-api-key": "secret-test-key"}
    assert captured["url"].endswith("gemini-test:generateContent")
