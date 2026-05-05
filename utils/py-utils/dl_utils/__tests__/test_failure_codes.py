"""Tests for failure_codes utility module."""
from dl_utils.failure_codes import get_failure_code_description


class TestGetFailureCodeDescription:
    def test_known_code_has_correct_description(self):
        """Spot check one known code to prove the CSV is being read correctly."""
        assert get_failure_code_description('DL_PDMV_001') == 'Letter rejected by PDM'

    def test_returns_none_for_unknown_code(self):
        assert get_failure_code_description('UNKNOWN_CODE') is None

    def test_returns_none_for_empty_string(self):
        assert get_failure_code_description('') is None
