from PIL import Image
import struct
import argparse
import json
import hashlib
import os

MAGIC = b"WBIP"

def write_chunk(f, chunk_type, data):
    f.write(chunk_type.encode("ascii"))
    f.write(struct.pack("<I", len(data)))
    f.write(data)

def generate_keystream(password, salt, length):
    stream = bytearray()

    counter = 0

    while len(stream) < length:

        block = hashlib.sha256(
            password.encode("utf-8") +
            salt +
            struct.pack("<I", counter)
        ).digest()

        stream.extend(block)

        counter += 1

    return bytes(stream[:length])

def xor_data(data, key):
    return bytes(a ^ b for a, b in zip(data, key))

parser = argparse.ArgumentParser()

parser.add_argument("input")
parser.add_argument("output")

parser.add_argument(
    "-m",
    "--message",
    default=""
)

parser.add_argument(
    "-p",
    "--password",
    required=True
)

args = parser.parse_args()

img = Image.open(args.input).convert("RGBA")

width, height = img.size

pixels = img.tobytes()

metadata = {
    "message": args.message
}

metadata_bytes = json.dumps(
    metadata
).encode("utf-8")

salt = os.urandom(16)

keystream = generate_keystream(
    args.password,
    salt,
    len(pixels)
)

encrypted_pixels = xor_data(
    pixels,
    keystream
)

with open(args.output, "wb") as f:

    f.write(MAGIC)

    f.write(struct.pack("<I", 1))

    head = struct.pack(
        "<II",
        width,
        height
    )

    write_chunk(f, "HEAD", head)

    write_chunk(
        f,
        "META",
        metadata_bytes
    )

    write_chunk(
        f,
        "SALT",
        salt
    )

    write_chunk(
        f,
        "DATA",
        encrypted_pixels
    )

    write_chunk(f, "END!", b"")

print(f"Created encrypted WBIP: {args.output}")
