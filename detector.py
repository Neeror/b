import time
from collections import deque
from dataclasses import dataclass, field
from typing import Optional

import cv2
import mediapipe as mp
import numpy as np

_pose      = mp.solutions.pose
_holistic  = mp.solutions.holistic

LEFT_EYE  = [33, 160, 158, 133, 153, 144]
RIGHT_EYE = [362, 385, 387, 263, 373, 380]

FOREHEAD_IDX  = 10
EAR_THRESHOLD = 0.20
BLINK_COOLDOWN = 0.15
BLINK_WINDOW   = 60.0
NORMAL_BLINKS  = 15


@dataclass
class SensorValues:
    posture:    float = 100.0
    eye_strain: float = 0.0
    activity:   float = 50.0
    stress:     float = 20.0
    light:      float = 400.0
    heart_rate: float = 70.0


def _dist2d(a, b) -> float:
    return np.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)


def _ear(landmarks, indices: list[int]) -> float:
    p = [landmarks[i] for i in indices]
    v1 = _dist2d(p[1], p[5])
    v2 = _dist2d(p[2], p[4])
    h  = _dist2d(p[0], p[3])
    return (v1 + v2) / (2.0 * h) if h > 1e-6 else 0.0


class NeuroDetector:
    def __init__(self, smoothing: int = 30) -> None:
        self._holistic = _holistic.Holistic(
            static_image_mode=False,
            model_complexity=1,
            smooth_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )

        self._pose_buf:  deque[float] = deque(maxlen=smoothing)
        self._move_buf:  deque[float] = deque(maxlen=smoothing)
        self._ear_buf:   deque[float] = deque(maxlen=smoothing)
        self._ppg_buf:   deque[float] = deque(maxlen=150)

        self._prev_pose: Optional[list] = None
        self._blink_times: deque[float] = deque(maxlen=30)
        self._last_blink:  float        = 0.0

    def _posture(self, pose) -> float:
        lm   = pose.landmark
        ls   = lm[_pose.PoseLandmark.LEFT_SHOULDER]
        rs   = lm[_pose.PoseLandmark.RIGHT_SHOULDER]
        nose = lm[_pose.PoseLandmark.NOSE]

        roll_score    = max(0.0, 1.0 - abs(ls.y - rs.y) * 8.0)
        cx            = (ls.x + rs.x) / 2.0
        lateral_score = max(0.0, 1.0 - abs(nose.x - cx) * 5.0)
        cz            = (ls.z + rs.z) / 2.0
        forward_score = max(0.0, min(1.0, 0.5 + (cz - nose.z) * 2.0))

        raw = (roll_score * 0.3 + lateral_score * 0.3 + forward_score * 0.4) * 100.0
        self._pose_buf.append(raw)
        return round(sum(self._pose_buf) / len(self._pose_buf), 1)

    def _eye_and_stress(self, face) -> tuple[float, float]:
        lm  = face.landmark
        ear = (_ear(lm, LEFT_EYE) + _ear(lm, RIGHT_EYE)) / 2.0

        self._ear_buf.append(ear)
        smooth_ear = sum(self._ear_buf) / len(self._ear_buf)

        now = time.time()
        if ear < EAR_THRESHOLD and (now - self._last_blink) > BLINK_COOLDOWN:
            self._blink_times.append(now)
            self._last_blink = now

        while self._blink_times and now - self._blink_times[0] > BLINK_WINDOW:
            self._blink_times.popleft()

        bpm = len(self._blink_times)

        if bpm < 5:
            strain = 80.0 + (5 - bpm) * 4.0
        elif bpm < 12:
            strain = 60.0 + (12 - bpm) * 2.5
        elif bpm <= NORMAL_BLINKS:
            strain = (NORMAL_BLINKS - bpm) * 4.0
        else:
            strain = 0.0

        if smooth_ear > 0.35 and bpm < 10:
            strain = min(100.0, strain + 20.0)

        stress = min(100.0, abs(bpm - NORMAL_BLINKS) * 3.5)
        return round(min(100.0, strain), 1), round(stress, 1)

    def _activity(self, pose) -> float:
        current = [(lm.x, lm.y) for lm in pose.landmark]

        if self._prev_pose is None:
            self._prev_pose = current
            self._move_buf.append(0.0)
            return 50.0

        movement = sum(
            np.sqrt((c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2)
            for c, p in zip(current, self._prev_pose)
        )
        self._prev_pose = current

        value = min(100.0, movement * 500.0)
        self._move_buf.append(value)
        return round(sum(self._move_buf) / len(self._move_buf), 1)

    def _light(self, frame: np.ndarray) -> float:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        return round(float(np.mean(gray)) / 255.0 * 1000.0, 1)

    def _heart_rate(self, frame: np.ndarray, face) -> float:
        h, w    = frame.shape[:2]
        pt      = face.landmark[FOREHEAD_IDX]
        fx, fy  = int(pt.x * w), int(pt.y * h)
        patch   = frame[max(0, fy - 10):fy + 10, max(0, fx - 10):fx + 10]

        if patch.size == 0:
            return 70.0

        self._ppg_buf.append(float(np.mean(patch[:, :, 1])))

        if len(self._ppg_buf) < 60:
            return 70.0

        signal = np.array(self._ppg_buf)
        signal = signal - np.mean(signal)
        freqs  = np.fft.rfftfreq(len(signal), d=1.0 / 30)
        mag    = np.abs(np.fft.rfft(signal))
        mask   = (freqs >= 0.7) & (freqs <= 3.5)

        if not np.any(mask):
            return 70.0

        bpm = freqs[mask][np.argmax(mag[mask])] * 60.0
        return round(max(30.0, min(220.0, bpm)), 1)

    def process(self, frame: np.ndarray) -> SensorValues:
        rgb     = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self._holistic.process(rgb)
        values  = SensorValues()

        values.light = self._light(frame)

        if results.pose_landmarks:
            values.posture  = self._posture(results.pose_landmarks)
            values.activity = self._activity(results.pose_landmarks)

        if results.face_landmarks:
            values.eye_strain, values.stress = self._eye_and_stress(results.face_landmarks)
            values.heart_rate = self._heart_rate(frame, results.face_landmarks)

        return values

    def close(self) -> None:
        self._holistic.close()

    def __enter__(self):
        return self

    def __exit__(self, *_) -> None:
        self.close()