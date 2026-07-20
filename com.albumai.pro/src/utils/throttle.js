export default function throttle(

    callback,

    delay = 300

) {

    let waiting = false;

    let lastArgs = null;

    return function (...args) {

        if (waiting) {

            lastArgs = args;

            return;

        }

        callback.apply(

            this,

            args

        );

        waiting = true;

        setTimeout(() => {

            waiting = false;

            if (lastArgs) {

                callback.apply(

                    this,

                    lastArgs

                );

                lastArgs = null;

            }

        }, delay);

    };

}