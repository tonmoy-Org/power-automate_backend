const clients = new Set();

/**
 * Express middleware / route handler for SSE connections
 */
const sseHandler = (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders && res.flushHeaders();

    clients.add(res);

    req.on('close', () => {
        clients.delete(res);
    });
};

/**
 * Broadcast an event and payload to all connected frontend clients
 * @param {string} event - Event name (e.g. 'number_updated', 'number_dead', 'number_completed')
 * @param {object} data - Payload data
 */
const broadcast = (event, data) => {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of clients) {
        try {
            client.write(payload);
        } catch (e) {
            clients.delete(client);
        }
    }
};

module.exports = {
    sseHandler,
    broadcast
};
