export default function debounce(

    callback,

    delay = 300

) {

    let timer = null;

    return function (...args) {

        clearTimeout(timer);

        timer = setTimeout(() => {

            callback.apply(

                this,

                args

            );

        }, delay);

    };

}