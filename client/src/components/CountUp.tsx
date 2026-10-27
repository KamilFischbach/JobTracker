import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react';
import { useEffect } from 'react';

/** A number that counts up to `value`, and animates again whenever it changes. */
export function CountUp({
  value,
  suffix = '',
}: {
  value: number;
  suffix?: string;
}) {
  const count = useMotionValue(0);
  const text = useTransform(
    count,
    (latest) => `${Math.round(latest)}${suffix}`,
  );
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      count.set(value);
      return;
    }
    const controls = animate(count, value, {
      duration: 1.4,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [count, value, reduceMotion]);

  return (
    <>
      {/* Screen readers get the final number, not every step of the animation. */}
      <span className='sr-only'>
        {value}
        {suffix}
      </span>
      <motion.span aria-hidden='true'>{text}</motion.span>
    </>
  );
}
