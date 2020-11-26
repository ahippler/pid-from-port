const http = require("http");
const test = require("ava");
const getPort = require("get-port");
const pidFromPort = require(".");

const srv = () =>
    http.createServer((_, response) => {
        response.end();
    });

test.serial("success", async (t) => {
    const port = await getPort();
    const server = srv().listen(port);
    t.truthy(await pidFromPort(port));
    server.close();
});

test.serial("fail", async (t) => {
    await t.throwsAsync(
        () => pidFromPort(0),
        null,
        "Couldn't find a process with port `0`",
    );
    await t.throwsAsync(
        () => pidFromPort.all([0]),
        null,
        "Couldn't find a process with port `0`",
    );
});

test.serial("accepts a number", async (t) => {
    await t.throwsAsync(
        () => pidFromPort("foo"),
        null,
        "Expected a number, got string",
    );
});

test.serial("all", async (t) => {
    const [p1, p2] = await Promise.all([getPort(), getPort()]);
    const [s1, s2] = [srv().listen(p1), srv().listen(p2)];
    const ports = await pidFromPort.all([p1, p2]);

    t.true(ports instanceof Map);

    for (const x of ports.values()) {
        t.is(typeof x, "number");
    }

    s1.close();
    s2.close();
});

test.serial("list", async (t) => {
    const list = await pidFromPort.list();
    t.true(list instanceof Map);
    await t.notThrowsAsync(() => pidFromPort.all([...list.keys()]));
});
