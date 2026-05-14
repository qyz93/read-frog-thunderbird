#!/usr/bin/env node
import { Buffer } from "node:buffer"
import { readdir, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { deflateRawSync } from "node:zlib"
import {
  THUNDERBIRD_BUILD_DIR,
  validateThunderbirdBuildDir,
} from "./lib/thunderbird-build-validation.mjs"

const OUTPUT_DIR = ".output"
const ZIP_VERSION_NEEDED = 20
const UTF8_FLAG = 0x0800
const DEFLATE_METHOD = 8

function makeCrc32Table() {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[i] = c >>> 0
  }
  return table
}

const CRC32_TABLE = makeCrc32Table()

function crc32(buffer) {
  let crc = 0xFFFFFFFF
  for (const byte of buffer) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function toDosDateTime(date) {
  const year = Math.max(1980, date.getFullYear())
  const dosTime = (date.getHours() << 11)
    | (date.getMinutes() << 5)
    | Math.floor(date.getSeconds() / 2)
  const dosDate = ((year - 1980) << 9)
    | ((date.getMonth() + 1) << 5)
    | date.getDate()
  return { dosTime, dosDate }
}

function writeUInt16(value) {
  const buffer = Buffer.allocUnsafe(2)
  buffer.writeUInt16LE(value)
  return buffer
}

function writeUInt32(value) {
  const buffer = Buffer.allocUnsafe(4)
  buffer.writeUInt32LE(value >>> 0)
  return buffer
}

async function listFiles(dir, root = dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await listFiles(fullPath, root))
    }
    else if (entry.isFile()) {
      files.push({
        fullPath,
        name: path.relative(root, fullPath).replaceAll(path.sep, "/"),
      })
    }
  }

  return files.sort((a, b) => a.name.localeCompare(b.name))
}

function createLocalFileHeader(entry) {
  return Buffer.concat([
    writeUInt32(0x04034B50),
    writeUInt16(ZIP_VERSION_NEEDED),
    writeUInt16(UTF8_FLAG),
    writeUInt16(DEFLATE_METHOD),
    writeUInt16(entry.dosTime),
    writeUInt16(entry.dosDate),
    writeUInt32(entry.crc),
    writeUInt32(entry.compressedSize),
    writeUInt32(entry.uncompressedSize),
    writeUInt16(entry.fileName.length),
    writeUInt16(0),
    entry.fileName,
  ])
}

function createCentralDirectoryHeader(entry) {
  return Buffer.concat([
    writeUInt32(0x02014B50),
    writeUInt16(ZIP_VERSION_NEEDED),
    writeUInt16(ZIP_VERSION_NEEDED),
    writeUInt16(UTF8_FLAG),
    writeUInt16(DEFLATE_METHOD),
    writeUInt16(entry.dosTime),
    writeUInt16(entry.dosDate),
    writeUInt32(entry.crc),
    writeUInt32(entry.compressedSize),
    writeUInt32(entry.uncompressedSize),
    writeUInt16(entry.fileName.length),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt32(0),
    writeUInt32(entry.offset),
    entry.fileName,
  ])
}

function createEndOfCentralDirectory(entryCount, centralDirectorySize, centralDirectoryOffset) {
  return Buffer.concat([
    writeUInt32(0x06054B50),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(entryCount),
    writeUInt16(entryCount),
    writeUInt32(centralDirectorySize),
    writeUInt32(centralDirectoryOffset),
    writeUInt16(0),
  ])
}

async function createZipFromDirectory(sourceDir, destinationPath) {
  const files = await listFiles(sourceDir)
  const localParts = []
  const centralParts = []
  const entries = []
  let offset = 0

  for (const file of files) {
    const raw = await readFile(file.fullPath)
    const fileStat = await stat(file.fullPath)
    const compressed = deflateRawSync(raw, { level: 9 })
    const fileName = Buffer.from(file.name, "utf8")
    const { dosTime, dosDate } = toDosDateTime(fileStat.mtime)
    const entry = {
      fileName,
      dosTime,
      dosDate,
      crc: crc32(raw),
      compressedSize: compressed.length,
      uncompressedSize: raw.length,
      offset,
    }

    const localHeader = createLocalFileHeader(entry)
    localParts.push(localHeader, compressed)
    offset += localHeader.length + compressed.length
    entries.push(entry)
  }

  for (const entry of entries) {
    centralParts.push(createCentralDirectoryHeader(entry))
  }

  const centralDirectory = Buffer.concat(centralParts)
  const end = createEndOfCentralDirectory(entries.length, centralDirectory.length, offset)
  await writeFile(destinationPath, Buffer.concat([...localParts, centralDirectory, end]))
}

const buildDir = process.argv[2] ?? THUNDERBIRD_BUILD_DIR
const errors = await validateThunderbirdBuildDir(buildDir)
if (errors.length > 0) {
  console.error("Thunderbird manifest validation failed:")
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}

const manifest = JSON.parse(await readFile(path.join(buildDir, "manifest.json"), "utf8"))
const version = manifest.version ?? "dev"
const destinationPath = process.argv[3] ?? path.join(OUTPUT_DIR, `read-frog-thunderbird-${version}.xpi`)
await createZipFromDirectory(buildDir, destinationPath)
console.log(`Packaged Thunderbird XPI: ${destinationPath}`)
