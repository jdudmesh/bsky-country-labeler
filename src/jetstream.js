import "@atcute/bluesky/lexicons";
import { EventEmitter } from "node:events";

/**
 * The Jetstream client.
 */
export class Jetstream extends EventEmitter {
    /** WebSocket connection to the server. */
    ws;
    /** The full connection URL. */
    url;
    /** The current cursor. */
    cursor;
    /** The WebSocket implementation to use. */
    wsImpl;
    constructor(options) {
        super();
        options ??= {};
        if (options.ws)
            this.wsImpl = options.ws;
        if (typeof globalThis.WebSocket === "undefined" && !this.wsImpl) {
            throw new Error(`No WebSocket implementation was found in your environment. You must provide an implementation as the \`ws\` option.

For example, in a Node.js environment, \`npm install ws\` and then:
import { Jetstream } from "@skyware/jetstream";
import WebSocket from "ws";

const jetstream = new Jetstream({
	ws: WebSocket,
});`);
        }
        this.url = new URL(options.endpoint ?? "wss://jetstream1.us-east.bsky.network/subscribe");
        options.wantedCollections?.forEach((collection) => {
            this.url.searchParams.append("wantedCollections", collection);
        });
        options.wantedDids?.forEach((did) => {
            this.url.searchParams.append("wantedDids", did);
        });
        if (options.maxMessageSizeBytes) {
            this.url.searchParams.append("maxMessageSizeBytes", `${options.maxMessageSizeBytes}`);
        }
        if (options.cursor)
            this.cursor = options.cursor;
    }
    /**
     * Opens a WebSocket connection to the server.
     */
    start() {
        const url = this.createUrl();
        this.ws = new WebSocket(url);
        this.ws.onopen = () => this.emit("open");
        this.ws.onclose = () => this.emit("close");
        this.ws.onerror = ({ error }) => this.emit("error", error, this.cursor);
        this.ws.onmessage = (data) => {
            try {
                const event = JSON.parse(data.data);
                if (event.time_us > (this.cursor ?? 0))
                    this.cursor = event.time_us;
                switch (event.kind) {
                    case EventType.Commit:
                        if (!event.commit?.collection || !event.commit.rkey || !event.commit.rev) {
                            return;
                        }
                        if (event.commit.operation === CommitType.Create && !event.commit.record) {
                            return;
                        }
                        this.emit("commit", event);
                        // @ts-expect-error – We know we can use collection name as an event.
                        this.emit(event.commit.collection, event);
                        break;
                    case EventType.Account:
                        if (!event.account?.did)
                            return;
                        this.emit("account", event);
                        break;
                    case EventType.Identity:
                        if (!event.identity?.did)
                            return;
                        this.emit("identity", event);
                        break;
                }
            }
            catch (e) {
                this.emit("error", e instanceof Error ? e : new Error(e), this.cursor);
            }
        };
    }
    /**
     * Closes the WebSocket connection.
     */
    close() {
        this.ws?.close();
    }
    /**
     * Listen for records created in a specific collection.
     * @param collection The name of the collection to listen for.
     * @param listener A callback function that receives the commit event.
     */
    onCreate(collection, listener) {
        this.on(collection, ({ commit, ...event }) => {
            if (commit.operation === CommitType.Create)
                listener({ commit, ...event });
        });
    }
    /**
     * Listen for records updated in a specific collection.
     * @param collection The name of the collection to listen for.
     * @param listener A callback function that receives the commit event.
     */
    onUpdate(collection, listener) {
        this.on(collection, ({ commit, ...event }) => {
            if (commit.operation === CommitType.Update)
                listener({ commit, ...event });
        });
    }
    /**
     * Listen for records deleted in a specific collection.
     * @param collection The name of the collection to listen for.
     * @param listener A callback function that receives the commit event.
     */
    onDelete(collection, listener) {
        this.on(collection, ({ commit, ...event }) => {
            if (commit.operation === CommitType.Delete)
                listener({ commit, ...event });
        });
    }
    /**
     * Send a message to update options for the duration of this connection.
     */
    updateOptions(payload) {
        if (!this.ws)
            throw new Error("Not connected.");
        if (payload.wantedDids) {
            this.url.searchParams.delete("wantedDids");
            payload.wantedDids.forEach((did) => {
                this.url.searchParams.append("wantedDids", did);
            });
        }
        if (payload.wantedCollections) {
            this.url.searchParams.delete("wantedCollections");
            payload.wantedCollections.forEach((collection) => {
                this.url.searchParams.append("wantedCollections", collection);
            });
        }
        if (payload.maxMessageSizeBytes) {
            this.url.searchParams.set("maxMessageSizeBytes", payload.maxMessageSizeBytes.toString());
        }
        this.ws.send(JSON.stringify({ type: "options_update", payload }));
    }
    createUrl() {
        if (this.cursor)
            this.url.searchParams.set("cursor", this.cursor.toString());
        return this.url.toString();
    }
    /**
     * @param event The event to listen for.
     * @param listener The callback function, called when the event is emitted.
     */
    on(event, listener) {
        return super.on(event, listener);
    }
}
/**
 * The types of events that are emitted by {@link Jetstream}.
 * @enum
 */
export const EventType = {
    /** A new commit. */
    Commit: "commit",
    /** An account's status was updated. */
    Account: "account",
    /** An account's identity was updated. */
    Identity: "identity",
};
/**
 * The types of commits that can be received.
 * @enum
 */
export const CommitType = {
    /** A record was created. */
    Create: "create",
    /** A record was updated. */
    Update: "update",
    /** A record was deleted. */
    Delete: "delete",
};
