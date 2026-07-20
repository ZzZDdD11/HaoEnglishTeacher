from app.tasks.process_video import _audio_filename_from_path


def test_audio_filename_from_path_absolute():
    assert _audio_filename_from_path("/tmp/uploads/VID123.wav") == "VID123.wav"


def test_audio_filename_from_path_relative():
    assert _audio_filename_from_path("VID.wav") == "VID.wav"
