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

    refresh() {

        this.listeners.forEach(listener => listener());

    }

}

export default new RefreshService();