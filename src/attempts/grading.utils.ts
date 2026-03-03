export function calculateBandScore(rawScore: number, module: 'LISTENING' | 'READING'): number {
  if (rawScore <= 0) return 0;
  if (rawScore >= 39) return 9.0;

  const listeningScale = [
    { min: 39, band: 9.0 }, { min: 37, band: 8.5 }, { min: 35, band: 8.0 },
    { min: 32, band: 7.5 }, { min: 30, band: 7.0 }, { min: 27, band: 6.5 },
    { min: 23, band: 6.0 }, { min: 20, band: 5.5 }, { min: 16, band: 5.0 },
    { min: 13, band: 4.5 }, { min: 10, band: 4.0 }, { min: 7, band: 3.5 },
    { min: 5, band: 3.0 }, { min: 3, band: 2.5 }, { min: 0, band: 1.0 }
  ];

  // Academic Reading (default for mock platform)
  const readingScale = [
    { min: 39, band: 9.0 }, { min: 37, band: 8.5 }, { min: 35, band: 8.0 },
    { min: 33, band: 7.5 }, { min: 30, band: 7.0 }, { min: 27, band: 6.5 },
    { min: 23, band: 6.0 }, { min: 19, band: 5.5 }, { min: 15, band: 5.0 },
    { min: 13, band: 4.5 }, { min: 10, band: 4.0 }, { min: 8, band: 3.5 },
    { min: 6, band: 3.0 }, { min: 4, band: 2.5 }, { min: 0, band: 1.0 }
  ];

  const scale = module === 'LISTENING' ? listeningScale : readingScale;
  const match = scale.find(s => rawScore >= s.min);
  return match ? match.band : 1.0;
}

export function roundToIELTS(score: number): number {
  return Math.round(score * 2) / 2;
}

