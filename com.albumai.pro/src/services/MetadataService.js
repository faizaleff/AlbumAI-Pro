class MetadataService {

    constructor() {

        this.cache = new Map();

    }

    has(photo) {

        return this.cache.has(photo.file?.nativePath);

    }

    get(photo) {

        return this.cache.get(photo.file?.nativePath);

    }

    async load(photo) {

        const key = photo.file?.nativePath;

        if (!key)
            return null;

        if (this.cache.has(key))
            return this.cache.get(key);

        const metadata = {

            name: photo.name,

            extension: photo.extension,

            path: photo.file.nativePath,

            size: photo.file.size || 0,

            created: photo.file.dateCreated || null,

            modified: photo.file.dateModified || null,

            width: photo.width || null,

            height: photo.height || null,

            orientation: null,

            dpi: null,

            colorSpace: null,

            camera: null,

            lens: null,

            focalLength: null,

            aperture: null,

            shutterSpeed: null,

            iso: null,

            flash: null,

            gps: null,

            dateTaken: null,

            rating: photo.rating || 0,

            favorite: photo.favorite || false,

            aiScore: photo.aiScore || 0,

            tags: photo.tags || []

        };

        this.cache.set(key, metadata);

        return metadata;

    }

    async update(photo, values = {}) {

        const metadata = await this.load(photo);

        Object.assign(metadata, values);

        return metadata;

    }

    remove(photo) {

        this.cache.delete(photo.file?.nativePath);

    }

    clear() {

        this.cache.clear();

    }

    size() {

        return this.cache.size;

    }

    all() {

        return [...this.cache.values()];

    }

}

export default new MetadataService();