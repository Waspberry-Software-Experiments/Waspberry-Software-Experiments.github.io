class WBIP {

    constructor() {
        this.password = "";
    }

    pass(password) {
        this.password = password;
    }

    async fetchBuffer(url) {

        const res = await fetch(url);

        return await res.arrayBuffer();
    }

    async generateKeystream(
        password,
        salt,
        length
    ) {

        const stream =
            new Uint8Array(length);

        const encoder =
            new TextEncoder();

        const passwordBytes =
            encoder.encode(password);

        let offset = 0;

        let counter = 0;

        while (offset < length) {

            const counterBytes =
                new Uint8Array(4);

            new DataView(
                counterBytes.buffer
            ).setUint32(
                0,
                counter,
                true
            );

            const combined =
                new Uint8Array(
                    passwordBytes.length +
                    salt.byteLength +
                    4
                );

            combined.set(
                passwordBytes,
                0
            );

            combined.set(
                new Uint8Array(salt),
                passwordBytes.length
            );

            combined.set(
                counterBytes,
                passwordBytes.length +
                salt.byteLength
            );

            const hashBuffer =
                await crypto.subtle.digest(
                    "SHA-256",
                    combined
                );

            const hash =
                new Uint8Array(hashBuffer);

            stream.set(
                hash.slice(
                    0,
                    Math.min(
                        hash.length,
                        length - offset
                    )
                ),
                offset
            );

            offset += hash.length;

            counter++;
        }

        return stream;
    }

    xorData(data, key) {

        const out =
            new Uint8Array(data.length);

        for (let i = 0; i < data.length; i++) {

            out[i] =
                data[i] ^ key[i];
        }

        return out;
    }

    async parse(buffer) {

        const view =
            new DataView(buffer);

        const magic =
            String.fromCharCode(
                ...new Uint8Array(
                    buffer,
                    0,
                    4
                )
            );

        if (magic !== "WBIP") {
            throw new Error(
                "Invalid WBIP file"
            );
        }

        const version =
            view.getUint32(4, true);

        let offset = 8;

        const result = {
            version,
            width: 0,
            height: 0,
            metadata: {},
            pixels: null
        };

        let salt = null;

        let encrypted = null;

        while (offset < buffer.byteLength) {

            const type =
                String.fromCharCode(
                    ...new Uint8Array(
                        buffer,
                        offset,
                        4
                    )
                );

            offset += 4;

            const size =
                view.getUint32(
                    offset,
                    true
                );

            offset += 4;

            const chunk =
                buffer.slice(
                    offset,
                    offset + size
                );

            offset += size;

            if (type === "HEAD") {

                const head =
                    new DataView(chunk);

                result.width =
                    head.getUint32(
                        0,
                        true
                    );

                result.height =
                    head.getUint32(
                        4,
                        true
                    );
            }

            else if (type === "META") {

                const text =
                    new TextDecoder()
                    .decode(chunk);

                result.metadata =
                    JSON.parse(text);
            }

            else if (type === "SALT") {

                salt = chunk;
            }

            else if (type === "DATA") {

                encrypted = chunk;
            }

            else if (type === "END!") {

                break;
            }
        }

        if (!this.password) {

            throw new Error(
                "No password set"
            );
        }

        const keystream =
            await this.generateKeystream(
                this.password,
                salt,
                encrypted.byteLength
            );

        const decrypted =
            this.xorData(
                new Uint8Array(encrypted),
                keystream
            );

        result.pixels =
            new Uint8ClampedArray(
                decrypted
            );

        return result;
    }

    async open(url) {

        const buffer =
            await this.fetchBuffer(url);

        return await this.parse(buffer);
    }

    async getMessage(url) {

        const img =
            await this.open(url);

        return img.metadata.message;
    }

    async render(
        url,
        canvas,
        options = {}
    ) {

        const img =
            await this.open(url);

        const ctx =
            canvas.getContext("2d");

        const {
            width = img.width,
            height = img.height,
            preserveAspectRatio = true,
            smoothing = false
        } = options;

        let drawWidth = width;
        let drawHeight = height;

        if (preserveAspectRatio) {

            const ratio =
                Math.min(
                    width / img.width,
                    height / img.height
                );

            drawWidth =
                Math.floor(
                    img.width * ratio
                );

            drawHeight =
                Math.floor(
                    img.height * ratio
                );
        }

        canvas.width = width;
        canvas.height = height;

        ctx.imageSmoothingEnabled =
            smoothing;

        const imageData =
            new ImageData(
                img.pixels,
                img.width,
                img.height
            );

        const tempCanvas =
            document.createElement(
                "canvas"
            );

        tempCanvas.width =
            img.width;

        tempCanvas.height =
            img.height;

        const tempCtx =
            tempCanvas.getContext(
                "2d"
            );

        tempCtx.putImageData(
            imageData,
            0,
            0
        );

        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        ctx.drawImage(
            tempCanvas,
            0,
            0,
            drawWidth,
            drawHeight
        );
    }
}

window.wbip = new WBIP();
