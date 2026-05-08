class WBIF {
    async fetchBuffer(url) {
        const res = await fetch(url);
        return await res.arrayBuffer();
    }

    parse(buffer) {
        const view = new DataView(buffer);

        const magic =
            String.fromCharCode(
                ...new Uint8Array(buffer, 0, 4)
            );

        if (magic !== "WBIF") {
            throw new Error("Invalid WBIF file");
        }

        const version = view.getUint32(4, true);

        let offset = 8;

        const result = {
            version,
            width: 0,
            height: 0,
            metadata: {},
            pixels: null
        };

        while (offset < buffer.byteLength) {
            const type =
                String.fromCharCode(
                    ...new Uint8Array(buffer, offset, 4)
                );

            offset += 4;

            const size = view.getUint32(offset, true);
            offset += 4;

            const chunk = buffer.slice(offset, offset + size);

            offset += size;

            if (type === "HEAD") {
                const headView = new DataView(chunk);

                result.width =
                    headView.getUint32(0, true);

                result.height =
                    headView.getUint32(4, true);
            }

            else if (type === "META") {
                const text =
                    new TextDecoder().decode(chunk);

                result.metadata = JSON.parse(text);
            }

            else if (type === "DATA") {
                result.pixels =
                    new Uint8ClampedArray(chunk);
            }

            else if (type === "END!") {
                break;
            }
        }

        return result;
    }

    async open(url) {
        const buffer = await this.fetchBuffer(url);
        return this.parse(buffer);
    }

    async getMessage(url) {
        const img = await this.open(url);
        return img.metadata.message;
    }

    async render(url, canvas, options = {}) {
    const img = await this.open(url);

    const ctx = canvas.getContext("2d");

    const {
        width = img.width,
        height = img.height,
        preserveAspectRatio = true
    } = options;

    let drawWidth = width;
    let drawHeight = height;

    if (preserveAspectRatio) {
        const ratio =
            Math.min(
                width / img.width,
                height / img.height
            );

        drawWidth = Math.floor(img.width * ratio);
        drawHeight = Math.floor(img.height * ratio);
    }

    canvas.width = width;
    canvas.height = height;

    const imageData = new ImageData(
        img.pixels,
        img.width,
        img.height
    );

    const tempCanvas =
        document.createElement("canvas");

    tempCanvas.width = img.width;
    tempCanvas.height = img.height;

    const tempCtx =
        tempCanvas.getContext("2d");

    tempCtx.putImageData(imageData, 0, 0);

    // Clear main canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(
        tempCanvas,
        0,
        0,
        drawWidth,
        drawHeight
    );
}
}

window.wbif = new WBIF();
