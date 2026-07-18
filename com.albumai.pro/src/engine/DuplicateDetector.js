class DuplicateDetector {

    find(photos = []) {

        const duplicates = [];

        const seen = new Map();

        for (const photo of photos) {

            const key = this.createKey(photo);

            if (seen.has(key)) {

                duplicates.push({

                    original: seen.get(key),

                    duplicate: photo

                });

            } else {

                seen.set(key, photo);

            }

        }

        return duplicates;

    }

    remove(photos = []) {

        const unique = [];

        const seen = new Set();

        for (const photo of photos) {

            const key = this.createKey(photo);

            if (seen.has(key))
                continue;

            seen.add(key);

            unique.push(photo);

        }

        return unique;

    }

    group(photos = []) {

        const groups = new Map();

        for (const photo of photos) {

            const key = this.createKey(photo);

            if (!groups.has(key))
                groups.set(key, []);

            groups.get(key).push(photo);

        }

        return [...groups.values()]
            .filter(group => group.length > 1);

    }

    hasDuplicates(photos = []) {

        return this.find(photos).length > 0;

    }

    count(photos = []) {

        return this.find(photos).length;

    }

    createKey(photo) {

        const file = photo.file || {};

        return [

            photo.id || "",

            photo.name || "",

            file.nativePath || "",

            photo.width || "",

            photo.height || "",

            photo.size || ""

        ].join("|");

    }

}

export default new DuplicateDetector();