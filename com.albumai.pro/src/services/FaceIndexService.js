class FaceIndexService {

    constructor() {

        this.faces = new Map();

    }

    getKey(photo) {

        return photo.file?.nativePath || photo.name;

    }

    has(photo) {

        return this.faces.has(this.getKey(photo));

    }

    get(photo) {

        return this.faces.get(this.getKey(photo)) || [];

    }

    set(photo, faces = []) {

        this.faces.set(this.getKey(photo), faces);

    }

    add(photo, face) {

        const list = this.get(photo);

        list.push(face);

        this.faces.set(this.getKey(photo), list);

    }

    remove(photo) {

        this.faces.delete(this.getKey(photo));

    }

    clear() {

        this.faces.clear();

    }

    count(photo) {

        return this.get(photo).length;

    }

    all() {

        return [...this.faces.entries()];

    }

    findPerson(name) {

        const results = [];

        for (const [photoKey, faces] of this.faces) {

            const matches = faces.filter(face =>
                face.person === name
            );

            if (matches.length) {

                results.push({
                    photoKey,
                    faces: matches
                });

            }

        }

        return results;

    }

}

export default new FaceIndexService();