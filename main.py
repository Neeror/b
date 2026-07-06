import logging
import os
import signal
import sys
import time
from typing import NoReturn

import cv2
import requests
from dotenv import load_dotenv

from vision.detector import NeuroDetector, SensorValues

load_dotenv()

SERVER_URL   = os.getenv("NEURO_SERVER_URL", "http://localhost:3000")
CAMERA_INDEX = int(os.getenv("CAMERA_INDEX", "0"))
CAPTURE_FPS  = float(os.getenv("CAPTURE_FPS", "10"))
LOG_LEVEL    = os.getenv("LOG_LEVEL", "INFO")

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

SENSOR_MAP: dict[str, object] = {
    "POSTURE":    lambda v: v.posture,
    "EYE_STRAIN": lambda v: v.eye_strain,
    "ACTIVITY":   lambda v: v.activity,
    "STRESS":     lambda v: v.stress,
    "LIGHT":      lambda v: v.light,
    "HEART_RATE": lambda v: v.heart_rate,
}


def send_sensor(sensor_type: str, value: float) -> None:
    try:
        resp = requests.post(
            f"{SERVER_URL}/api/sensor",
            json={
                "type":      sensor_type,
                "value":     value,
                "timestamp": int(time.time() * 1000),
            },
            timeout=2,
        )
        if not resp.ok:
            log.warning("Server rejected %s=%s: %s", sensor_type, value, resp.text)
    except requests.RequestException as exc:
        log.warning("Failed to send %s: %s", sensor_type, exc)


def send_all(values: SensorValues) -> None:
    for sensor_type, getter in SENSOR_MAP.items():
        send_sensor(sensor_type, getter(values))


def run() -> NoReturn:
    cap = cv2.VideoCapture(CAMERA_INDEX)
    if not cap.isOpened():
        log.error("Cannot open camera index %d", CAMERA_INDEX)
        sys.exit(1)

    log.info("Camera ready. Sending to %s at %.1f fps", SERVER_URL, CAPTURE_FPS)

    interval = 1.0 / CAPTURE_FPS
    running  = True

    def _stop(sig, frame) -> None:
        nonlocal running
        log.info("Shutting down (signal %d)", sig)
        running = False

    signal.signal(signal.SIGINT,  _stop)
    signal.signal(signal.SIGTERM, _stop)

    with NeuroDetector() as detector:
        while running:
            tick = time.monotonic()

            ok, frame = cap.read()
            if not ok:
                log.warning("Frame read failed, skipping")
                time.sleep(interval)
                continue

            values = detector.process(frame)
            send_all(values)

            log.debug(
                "posture=%.1f eye=%.1f act=%.1f stress=%.1f light=%.1f hr=%.1f",
                values.posture, values.eye_strain, values.activity,
                values.stress,  values.light,      values.heart_rate,
            )

            sleep = max(0.0, interval - (time.monotonic() - tick))
            time.sleep(sleep)

    cap.release()
    log.info("Done")
    sys.exit(0)


if __name__ == "__main__":
    run()