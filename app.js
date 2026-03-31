const { parseArgs } = require('node:util');
const { existsSync, readFileSync, createWriteStream, createReadStream, writeFileSync } = require('node:fs');
const { basename } = require('node:path');
const { PNG } = require('pngjs');

const MAGIC = Buffer.from('YIMG');

function checkFileExists(path) {
    if (!existsSync(path)) {
        throw new Error(`File does not exist: ${path}`);
    }
}

function createIntBuffer(value) {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32BE(value);
    return buffer;
}

function encode(path) {
    checkFileExists(path);

    const simpleFileName = basename(path);
    const simpleFileNameBuffer = Buffer.from(simpleFileName, 'utf-8');

    const fileData = readFileSync(path);
    const fullData = Buffer.concat([
        MAGIC,
        createIntBuffer(simpleFileNameBuffer.length),
        simpleFileNameBuffer,
        createIntBuffer(fileData.length),
        fileData
    ]);

    const pixelCount = Math.ceil(fullData.length / 3);
    const width = Math.ceil(Math.sqrt(pixelCount));
    const height = Math.ceil(pixelCount / width);

    const png = new PNG({ width, height });

    for (let i = 0; i < pixelCount; i++) {
        const r = fullData[i * 3] || 0;
        const g = fullData[(i * 3) + 1] || 0;
        const b = fullData[(i * 3) + 2] || 0;

        const idx = i * 4;
        png.data[idx] = r;
        png.data[idx + 1] = g;
        png.data[idx + 2] = b;
        png.data[idx + 3] = 255; // alpha
    }

    const outputPath = `${__dirname}\\${simpleFileName}.png`;

    png.pack()
        .pipe(createWriteStream(outputPath))
        .on('close', () => {
            console.log(`Encoded as ${outputPath}`);
        });
}

function decode(path) {
    checkFileExists(path);

    createReadStream(path)
        .pipe(new PNG())
        .on('error', () => {
            console.error(`Path ${path} does not represent a valid PNG file`);
        })
        .on('parsed', result => {
            const bytes = [];

            for (let i = 0; i < result.length; i += 4) {
                bytes.push(result[i]);     // R
                bytes.push(result[i + 1]); // G
                bytes.push(result[i + 2]); // B
            }

            const fullData = Buffer.from(bytes);

            // Validate MAGIC
            const magic = fullData.subarray(0, 4);
            if (!magic.equals(MAGIC)) {
                throw new Error('Invalid file format (magic header mismatch)');
            }

            const fileNameLength = fullData.readUInt32BE(4);
            const fileNameBuffer = fullData.subarray(8, 8 + fileNameLength);
            const fileName = fileNameBuffer.toString('utf-8');

            const fileDataLength = fullData.readUInt32BE(8 + fileNameLength);
            const fileData = fullData.subarray(12 + fileNameLength, 12 + fileNameLength + fileDataLength);

            const outputPath = `${__dirname}\\${fileName}`;

            writeFileSync(outputPath, fileData);
            console.log(`Decoded as ${outputPath}`);
        });
}

const COMMANDS = ['encode', 'decode'];
const { positionals } = parseArgs({
    allowPositionals: true
});

if (positionals.length === 0) {
    console.error('Invalid command. Supply either "encode" or "decode"');
} else if (positionals.length === 1) {
    const cmd = positionals[0];
    if (COMMANDS.includes(cmd)) {
        console.error('File path is required.');
    } else {
        console.error(`Invalid command: "${cmd}"`);
    }
} else {
    const cmd = positionals[0];
    if (!COMMANDS.includes(cmd)) {
        console.error(`Invalid command: "${cmd}"`);
    } else if (positionals.length > 2) {
        console.error(`Invalid command: "${positionals.slice(2)}"`);
    } else {
        try {
            if (cmd === 'encode') {
                encode(positionals[1]);
            } else {
                decode(positionals[1]);
            }
        } catch (ex) {
            console.error(ex.message);
        }
    }
}