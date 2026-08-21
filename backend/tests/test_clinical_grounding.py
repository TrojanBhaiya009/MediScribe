import unittest

from routers.nvidia_asr import _normalize_text
from services.emr_engine import (
    _apply_transcript_grounding,
    _clean_text,
    _extract_simple_investigations,
    _extract_simple_medications,
)


class ClinicalGroundingTests(unittest.TestCase):
    def test_extracts_english_medication_and_ct_scan(self):
        transcript = "Prescribe paracetamol 500 mg twice daily and get a CT scan."

        self.assertEqual(
            _extract_simple_medications(transcript),
            [{
                "name": "Paracetamol",
                "dosage": "500 mg",
                "frequency": "Twice daily (BD)",
                "confidence": "green",
            }],
        )
        self.assertEqual(
            _extract_simple_investigations(transcript),
            [{"name": "CT scan", "confidence": "green"}],
        )

    def test_extracts_romanized_hindi_instructions(self):
        transcript = "Paracetamol 500mg subah shaam lena aur CT scan karwa lena."

        medication = _extract_simple_medications(transcript)[0]
        self.assertEqual(medication["dosage"], "500mg")
        self.assertEqual(medication["frequency"], "Twice daily (BD)")
        self.assertEqual(_extract_simple_investigations(transcript)[0]["name"], "CT scan")

    def test_preserves_and_extracts_devanagari(self):
        transcript = "पैरासिटामोल 500 मिलीग्राम दिन में दो बार और सीटी स्कैन करवा लीजिए।"

        self.assertEqual(_clean_text("तेज़ बुखार"), "तेज़ बुखार")
        self.assertTrue(_normalize_text(transcript))
        medication = _extract_simple_medications(transcript)[0]
        self.assertEqual(medication["name"], "Paracetamol")
        self.assertEqual(medication["frequency"], "Twice daily (BD)")
        self.assertEqual(_extract_simple_investigations(transcript)[0]["name"], "CT scan")

    def test_extracts_dose_before_medicine_name(self):
        medication = _extract_simple_medications(
            "Take two doses of paracetamol, one dose per night."
        )[0]

        self.assertEqual(medication["dosage"], "two doses")
        self.assertEqual(medication["frequency"], "At night")

    def test_extracts_unlisted_medicine_when_strength_is_spoken(self):
        medication = _extract_simple_medications(
            "Start cefpodoxime 200 mg twice daily for five days."
        )[0]

        self.assertEqual(medication["name"], "Cefpodoxime")
        self.assertEqual(medication["dosage"], "200 mg")
        self.assertEqual(medication["frequency"], "Twice daily (BD); for five days")

    def test_mentioned_test_without_order_requires_confirmation(self):
        result = _extract_simple_investigations("We discussed the old MRI report.")
        self.assertEqual(result, [{"name": "MRI", "confidence": "yellow"}])

    def test_grounding_removes_unsupported_generated_content(self):
        transcript = "Prescribe paracetamol 500 mg twice daily and get a CT scan."
        model_output = {
            "medications": [{"name": "Warfarin", "dosage": "5 mg", "frequency": "daily", "confidence": "green"}],
            "investigations": [{"name": "MRI", "confidence": "green"}],
            "diagnosis": {"value": "Pneumonia", "confidence": "green"},
            "inferenceNotes": [],
            "hallucinationCheck": {"isHallucinated": False, "details": None},
        }

        grounded = _apply_transcript_grounding(model_output, transcript)

        self.assertEqual(grounded["medications"][0]["name"], "Paracetamol")
        self.assertEqual(grounded["investigations"], [{"name": "CT scan", "confidence": "green"}])
        self.assertEqual(grounded["diagnosis"], {"value": None, "confidence": "blank"})
        self.assertTrue(grounded["hallucinationCheck"]["isHallucinated"])
        self.assertIn("Warfarin", grounded["hallucinationCheck"]["details"])


if __name__ == "__main__":
    unittest.main()
