import PhotoBrowserPerformance from "./PhotoBrowserPerformance";

class RefreshService {

    constructor() {

        this.listeners = [];

    }

    subscribe(listener) {

        this.listeners.push(listener);

        return () => {

            this.listeners =
                this.listeners.filter(l => l !== listener);

        };

    }

    refresh(scope = "all") {

        PhotoBrowserPerformance.recordRenderUpdate(
            "RefreshService",
            "publish",
            {
                scope,
                listeners: this.listeners.length
            }
        );
        this.listeners.forEach(listener => listener(scope));

    }

}

export default new RefreshService();
