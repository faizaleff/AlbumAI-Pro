import PhotoBrowserPerformance from "./PhotoBrowserPerformance";

class RefreshService {

    constructor() {

        this.listeners = new Set();

    }

    subscribe(listener) {

        this.listeners.add(listener);
        PhotoBrowserPerformance.trace("REFRESH_SUBSCRIBE", {
            subscribers: this.listeners.size
        });

        return () => {

            this.listeners.delete(listener);
            PhotoBrowserPerformance.trace("REFRESH_UNSUBSCRIBE", {
                subscribers: this.listeners.size
            });

        };

    }

    refresh(scope = "all") {

        PhotoBrowserPerformance.recordRenderUpdate(
            "RefreshService",
            "publish",
            {
                scope,
                listeners: this.listeners.size
            }
        );
        const listeners = [...this.listeners];
        PhotoBrowserPerformance.trace("REFRESH_SUBSCRIBER_COUNT", {
            subscribers: listeners.length
        });
        listeners.forEach(listener => {
            if (this.listeners.has(listener)) listener(scope);
        });

    }

}

export default new RefreshService();
