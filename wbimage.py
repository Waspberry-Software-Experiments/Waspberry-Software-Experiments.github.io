from PIL import Image
import struct
import argparse
import json

MAGIC = b"WBIF"

def write_chunk(f, chunk_type, data):
    chunk_type = chunk_type.encode("ascii")

    f.write(chunk_type)
    f.write(struct.pack("<I", len(data)))
    f.write(data)

parser = argparse.ArgumentParser()

parser.add_argument("input")
parser.add_argument("output")
parser.add_argument("-m", "--message", default="")

args = parser.parse_args()

img = Image.open(args.input).convert("RGBA")

width, height = img.size
pixels = img.tobytes()

metadata = {
    "message": args.message
}

metadata_bytes = json.dumps(metadata).encode("utf-8")

with open(args.output, "wb") as f:
    f.write(MAGIC)

    f.write(struct.pack("<I", 1))

    head = struct.pack("<II", width, height)
    write_chunk(f, "HEAD", head)

    write_chunk(f, "META", metadata_bytes)

    write_chunk(f, "DATA", pixels)

    write_chunk(f, "END!", b"")

print(f"Created {args.output}")
