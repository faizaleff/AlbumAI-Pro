import FaceIndexService from "../services/FaceIndexService";

class FaceGroupingEngine {

    group(photos = []) {

        const groups = new Map();

        for (const photo of photos) {

            const faces = FaceIndexService.get(photo) || [];

            if (!faces.length) {

                this.add(groups, "No Faces", photo);

                continue;

            }

            faces.forEach(face => {

                const person =

                    face.person ||
                    face.name ||
                    face.identity ||
                    "Unknown";

                this.add(groups, person, photo);

            });

        }

        return groups;

    }

    getGroup(photos = [], person = "Unknown") {

        return this.group(photos).get(person) || [];

    }

    people(photos = []) {

        return [...this.group(photos).keys()];

    }

    countPeople(photos = []) {

        return this.people(photos).length;

    }

    countFaces(photos = []) {

        let total = 0;

        for (const photo of photos)
            total += FaceIndexService.count(photo);

        return total;

    }

    largestGroup(photos = []) {

        const groups = this.group(photos);

        let largest = [];

        for (const photos of groups.values()) {

            if (photos.length > largest.length)
                largest = photos;

        }

        return largest;

    }

    ungrouped(photos = []) {

        return this.getGroup(photos, "No Faces");

    }

    add(groups, key, photo) {

        if (!groups.has(key))
            groups.set(key, []);

        groups.get(key).push(photo);

    }

}

export default new FaceGroupingEngine();