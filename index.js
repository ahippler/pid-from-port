"use strict";

const childProcess = require("child_process");
const { promisify } = require("util");

const exec = promisify(childProcess.exec);

async function execa(command) {
    const { stdout } = await exec(command);
    return stdout.trim();
}

function colsForPlatform() {
    switch (process.platform) {
        case "darwin":
            return [3, 8];
        case "linux":
            return [4, 6];
        case "win32":
            return [1, 4];
        default:
            throw new Error(`Unsupported platform \`${process.platform}\``);
    }
}

const cols = colsForPlatform();

async function darwin() {
    const protocols = await Promise.all([
        execa("netstat -anv -p tcp"),
        execa("netstat -anv -p udp"),
    ]);
    return protocols.join("\n");
}

async function linux() {
    return execa("ss -tunlp");
}

async function win32() {
    return execa("netstat -ano");
}

function isProtocol(x) {
    return /^\s*(tcp|udp)/i.test(x);
}

function parsePid(input) {
    if (typeof input !== "string") {
        return null;
    }

    const match = input.match(/(?:^|",|",pid=)(\d+)/);
    return match ? Number.parseInt(match[1], 10) : null;
}

function getPort(input, list) {
    const regex = new RegExp(`[.:]${input}$`);
    const port = list.find((x) => regex.test(x[cols[0]]));

    if (!port) {
        throw new Error(`Couldn't find a process with port \`${input}\``);
    }

    return parsePid(port[cols[1]]);
}

async function getListForPlatform() {
    switch (process.platform) {
        case "darwin":
            return darwin();
        case "linux":
            return linux();
        case "win32":
            return win32();
        default:
            throw new Error(`Unsupported platform \`${process.platform}\``);
    }
}

async function getList() {
    const result = [];
    const list = await getListForPlatform();
    const lines = list.split("\n");
    lines.forEach((line) => {
        if (isProtocol(line)) {
            result.push(line.match(/\S+/g) || []);
        }
    });
    return result;
}

module.exports = async (input) => {
    if (typeof input !== "number") {
        return Promise.reject(
            new TypeError(`Expected a number, got ${typeof input}`),
        );
    }

    const list = await getList();
    return getPort(input, list);
};

module.exports.all = async (input) => {
    if (!Array.isArray(input)) {
        return Promise.reject(
            new TypeError(`Expected an array, got ${typeof input}`),
        );
    }

    const list = await getList();
    const array = await Promise.all(input.map((x) => [x, getPort(x, list)]));
    return new Map(array);
};

module.exports.list = async () => {
    const list = await getList();
    const map = new Map();

    list.forEach((x) => {
        const match = x[cols[0]].match(/[^]*[.:](\d+)$/);
        if (match) {
            const port = Number.parseInt(match[1], 10);
            const pid = parsePid(x[cols[1]]);
            map.set(port, pid);
        }
    });

    return map;
};
