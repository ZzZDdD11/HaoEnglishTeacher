from app.models.material import Material


def test_material_has_audio_filename_field():
    m = Material(
        id="test-id",
        source_type="youtube",
        source_url="https://youtube.com/watch?v=x",
    )
    assert hasattr(m, "audio_filename")
