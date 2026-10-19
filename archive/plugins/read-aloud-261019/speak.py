"""The speaker of the read-aloud mod: `speak.py <text>` says the text on the headset.

The voice is the newest gpt-realtime model LiteLLM serves, found in its model list on each
run, so the mod never names one. The audio streams from LiteLLM's /v1/realtime and plays
as it arrives.
"""

import asyncio
import base64
import json
import re
import sys
from pathlib import Path

import httpx
import numpy as np
import sounddevice as sd
import websockets
import yaml

CONFIG = yaml.safe_load((Path(__file__).parent / "speak.yaml").read_text())
RATE = 24000
READ = "Read the user's text aloud exactly as written, word for word, in a natural voice. Add nothing."


def api_key() -> str:
    lines = Path(CONFIG["key_file"]).expanduser().read_text().splitlines()
    return [l.split("=", 1)[1].strip() for l in lines if l.startswith("OPENAI_API_KEY=")][-1]


def realtime_model(headers: dict) -> str:
    r = httpx.get(f"{CONFIG['litellm'].removesuffix('/v1')}/model/info", headers=headers, timeout=20)
    r.raise_for_status()
    names = [m["model_name"] for m in r.json()["data"] if re.fullmatch(r"gpt-realtime-[\d.]+", m["model_name"])]
    return max(names, key=lambda n: [int(p) for p in n.removeprefix("gpt-realtime-").split(".")])


def output_device() -> dict:
    # Windows' default output, as WASAPI reports it
    wasapi = [h for h in sd.query_hostapis() if "WASAPI" in h["name"]][0]
    index = wasapi["default_output_device"]
    return {"index": index, "rate": int(sd.query_devices(index)["default_samplerate"])}


async def speak(text: str):
    headers = {"Authorization": f"Bearer {api_key()}"}
    url = f"{CONFIG['litellm'].replace('https://', 'wss://')}/realtime?model={realtime_model(headers)}"
    out = output_device()
    async with websockets.connect(url, additional_headers=headers) as ws:
        await ws.send(json.dumps({"type": "session.update", "session": {"type": "realtime", "instructions": READ, "output_modalities": ["audio"], "audio": {"output": {"voice": CONFIG["voice"]}}}}))
        await ws.send(json.dumps({"type": "conversation.item.create", "item": {"type": "message", "role": "user", "content": [{"type": "input_text", "text": text}]}}))
        await ws.send(json.dumps({"type": "response.create"}))
        with sd.OutputStream(device=out["index"], channels=1, samplerate=out["rate"], dtype="int16") as stream:
            async for message in ws:
                event = json.loads(message)
                if event["type"] == "error":
                    raise RuntimeError(event["error"]["message"])
                if event["type"] == "response.output_audio.delta":
                    pcm = np.frombuffer(base64.b64decode(event["delta"]), dtype=np.int16)
                    if out["rate"] != RATE:
                        pcm = np.interp(np.arange(0, len(pcm), RATE / out["rate"]), np.arange(len(pcm)), pcm).astype(np.int16)
                    stream.write(pcm)
                if event["type"] == "response.done":
                    return


asyncio.run(speak(sys.argv[1]))
