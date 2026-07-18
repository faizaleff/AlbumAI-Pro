import MetadataService from "../services/MetadataService";

class EventGroupingEngine {

    async group(photos = []) {

        const groups = new Map();

        for (const photo of photos) {

            const metadata = await MetadataService.load(photo);

            const key = this.createEventKey(metadata);

            if (!groups.has(key))
                groups.set(key, []);

            groups.get(key).push(photo);

        }

        return groups;

    }

    async list(photos = []) {

        return [...(await this.group(photos)).values()];

    }

    async events(photos = []) {

        return [...(await this.group(photos)).keys()];

    }

    async largestEvent(photos = []) {

        const groups = await this.group(photos);

        let largest = [];

        for (const event of groups.values()) {

            if (event.length > largest.length)
                largest = event;

        }

        return largest;

    }

    async countEvents(photos = []) {

        return (await this.group(photos)).size;

    }

    async getEvent(photos = [], eventName) {

        return (await this.group(photos)).get(eventName) || [];

    }

    createEventKey(metadata) {

        const date = metadata.dateTaken
            ? new Date(metadata.dateTaken)
                    .toISOString()
                    .substring(0, 10)
            : "Unknown Date";

        const location =
            metadata.location ||
            metadata.city ||
            metadata.place ||
            "Unknown Location";

        return `${date} | ${location}`;

    }

}

export default new EventGroupingEngine();