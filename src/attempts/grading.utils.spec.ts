import { calculateBandScore, roundToIELTS } from './grading.utils';

describe('Grading Utils', () => {
  describe('calculateBandScore', () => {
    describe('LISTENING', () => {
      it('should return 9.0 for 39+ correct answers', () => {
        expect(calculateBandScore(39, 'LISTENING')).toBe(9.0);
        expect(calculateBandScore(40, 'LISTENING')).toBe(9.0);
      });

      it('should return correct middle scores', () => {
        expect(calculateBandScore(30, 'LISTENING')).toBe(7.0);
        expect(calculateBandScore(23, 'LISTENING')).toBe(6.0);
        expect(calculateBandScore(16, 'LISTENING')).toBe(5.0);
      });

      it('should return 1.0 for very low scores', () => {
        expect(calculateBandScore(1, 'LISTENING')).toBe(1.0);
      });

      it('should return 0 for 0 correct answers', () => {
        expect(calculateBandScore(0, 'LISTENING')).toBe(0);
      });
    });

    describe('READING', () => {
      it('should return 9.0 for 39+ correct answers', () => {
        expect(calculateBandScore(39, 'READING')).toBe(9.0);
      });

      it('should return correct middle scores', () => {
        expect(calculateBandScore(30, 'READING')).toBe(7.0);
        expect(calculateBandScore(23, 'READING')).toBe(6.0);
        expect(calculateBandScore(15, 'READING')).toBe(5.0);
      });
    });
  });

  describe('roundToIELTS', () => {
    it('should round to the nearest 0.5', () => {
      expect(roundToIELTS(6.25)).toBe(6.5);
      expect(roundToIELTS(6.75)).toBe(7.0);
      expect(roundToIELTS(6.1)).toBe(6.0);
      expect(roundToIELTS(6.4)).toBe(6.5);
      expect(roundToIELTS(6.6)).toBe(6.5);
      expect(roundToIELTS(6.9)).toBe(7.0);
    });
  });
});
