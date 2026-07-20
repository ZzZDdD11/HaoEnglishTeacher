from app.api.sessions import _sentence_text_for


class FakeMaterial:
    def __init__(self, transcript_json):
        self.transcript_json = transcript_json


def test_sentence_text_found():
    material = FakeMaterial({
        "segments": [
            {"sentence_index": 0, "text": "Hello there."},
            {"sentence_index": 1, "text": "How are you?"},
        ]
    })
    assert _sentence_text_for(material, 1) == "How are you?"


def test_sentence_text_index_out_of_range():
    material = FakeMaterial({
        "segments": [{"sentence_index": 0, "text": "Hello there."}]
    })
    assert _sentence_text_for(material, 5) is None


def test_sentence_text_no_material():
    assert _sentence_text_for(None, 0) is None


def test_sentence_text_no_transcript():
    material = FakeMaterial(None)
    assert _sentence_text_for(material, 0) is None
