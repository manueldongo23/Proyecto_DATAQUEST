import confetti from 'canvas-confetti';

export const useConfetti = () => {
  const fire = () => {
    const colors = ['#6366F1', '#8B5CF6', '#06B6D4', '#34D399', '#FBBF24'];

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors,
    });

    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
      });
    }, 150);
  };

  return { fireConfetti: fire, fireSuccess: fire };
};
