import os
import json
import sys

# Ensure backend directory is in the import path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.emr_engine import generate_emr_from_transcript

transcript = "I have been having high fever. You can take two dose of Paracetamol one dose per night. Thank you."
print("Running transcript:", transcript)
try:
    result = generate_emr_from_transcript(transcript)
    print("EMR JSON Output:")
    print(json.dumps(result, indent=2))
except Exception as e:
    import traceback
    traceback.print_exc()
