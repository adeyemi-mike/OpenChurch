#!/usr/bin/env python3
"""
Start the Next.js dev server as a detached double-fork daemon.

The sandbox reaps orphaned session-leader processes between tool calls
(nohup/setsid children die). A classic double-fork daemon survives:
fork -> setsid -> fork again -> grandchild (PPID 1, non-session-leader).

Usage:  python3 scripts/dev-daemon.py
Log:    dev.log (truncated on each start)
"""
import os
import sys

PROJECT = "/home/z/my-project"
LOG = os.path.join(PROJECT, "dev.log")


def db_is_empty() -> bool:
    """True when the SQLite dev database has no churches (e.g. the sandbox
    restored an earlier snapshot). Triggers an automatic demo reseed."""
    import sqlite3

    try:
        con = sqlite3.connect(os.path.join(PROJECT, "db", "custom.db"))
        try:
            n = con.execute("SELECT COUNT(*) FROM churches").fetchone()[0]
        finally:
            con.close()
        return n == 0
    except sqlite3.Error:
        return True  # missing table/file -> needs db push + seed


def reseed() -> None:
    import subprocess

    # Ensure the schema exists (safe: only called when the DB is empty),
    # then load the demo data.
    subprocess.run(
        ["bunx", "prisma", "db", "push", "--skip-generate", "--accept-data-loss"],
        cwd=PROJECT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.STDOUT,
        timeout=300,
    )
    subprocess.run(
        ["bun", "prisma/seed.ts"],
        cwd=PROJECT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.STDOUT,
        timeout=300,
    )


def main() -> None:
    if os.path.exists("/proc/net/tcp") and port_busy(3000):
        print("port 3000 already in use — server may already be running")
        sys.exit(0)

    if db_is_empty():
        print("dev database is empty — reseeding demo data…")
        reseed()

    pid = os.fork()
    if pid == 0:
        # child: new session, detach from controlling terminal
        os.setsid()
        if os.fork() > 0:
            os._exit(0)
        # grandchild: becomes the daemon
        os.chdir(PROJECT)
        os.umask(0o022)
        fd = os.open(LOG, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
        os.dup2(fd, 0)
        os.dup2(fd, 1)
        os.dup2(fd, 2)
        if fd > 2:
            os.close(fd)
        os.execvp("node", ["node", "node_modules/.bin/next", "dev", "-p", "3000"])
        os._exit(1)  # exec failed
    # parent: reap the middle child and exit
    os.waitpid(pid, 0)
    print(f"dev server daemonized, logging to {LOG}")


def port_busy(port: int) -> bool:
    def parse(path: str) -> set:
        out = set()
        try:
            with open(path) as f:
                next(f)  # header
                for line in f:
                    parts = line.split()
                    local, state = parts[1], parts[3]
                    if state == "0A":  # LISTEN
                        out.add(int(local.split(":")[1], 16))
        except (FileNotFoundError, StopIteration):
            pass
        return out

    return port in parse("/proc/net/tcp") | parse("/proc/net/tcp6")


if __name__ == "__main__":
    main()
