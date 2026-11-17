#!/usr/bin/env python3
"""Local SMTP sink for the password-recovery E2E test.

Accepts any message without auth on 127.0.0.1:2525 and writes each message
to /tmp/mailbox/<n>.eml so the test can assert real delivery and extract
the reset link.
"""
import asyncio
import os
from email import policy
from email.parser import BytesParser

from aiosmtpd.controller import Controller
from aiosmtpd.smtp import SMTP

MAILDIR = "/tmp/mailbox"
os.makedirs(MAILDIR, exist_ok=True)
counter = {"n": 0}


class Sink:
    async def handle_DATA(self, server, session, envelope):
        counter["n"] += 1
        path = os.path.join(MAILDIR, f"{counter['n']:03d}.eml")
        with open(path, "wb") as f:
            f.write(envelope.content)
        msg = BytesParser(policy=policy.default).parsebytes(envelope.content)
        print(
            f"[sink] message {counter['n']} from={envelope.mail_from} "
            f"to={envelope.rcpt_tos} subject={msg['Subject']!r} -> {path}",
            flush=True,
        )
        return "250 Message accepted for delivery"


if __name__ == "__main__":
    controller = Controller(Sink(), hostname="127.0.0.1", port=2525, decode_data=False)
    controller.start()
    print("[sink] SMTP sink listening on 127.0.0.1:2525", flush=True)
    try:
        asyncio.get_event_loop().run_forever()
    except KeyboardInterrupt:
        controller.stop()