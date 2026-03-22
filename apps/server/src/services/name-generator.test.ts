import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { generateRandomName } from './name-generator';

describe('generateRandomName', () => {
  let randomSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    randomSpy = undefined;
  });

  afterEach(() => {
    if (randomSpy) {
      randomSpy.mockRestore();
    }
  });

  test('returns a two-word title using adjective + noun format', () => {
    const name = generateRandomName();

    expect(name).toEqual(expect.any(String));
    expect(name).not.toBe('New Conversation');
    expect(name).toMatch(/^[A-Za-z]+ [A-Za-z]+$/);
  });

  test('selects deterministic words with a stubbed random function', () => {
    const mockedRandom = spyOn(Math, 'random')
      .mockReturnValueOnce(0.35)
      .mockReturnValueOnce(0.82);

    randomSpy = mockedRandom;

    const name = generateRandomName();
    const [adjective, noun] = name.split(' ');

    expect(['Sizzling', 'Velvet', 'Fuzzy', 'Mighty', 'Crispy', 'Bright', 'Quiet', 'Lucky', 'Swift', 'Brisk']).toContain(adjective);
    expect(['Truffle', 'Comet', 'Breeze', 'Canyon', 'Lantern', 'Orchid', 'Atlas', 'Meadow', 'Orbit', 'Dune']).toContain(noun);
    expect(name).toEqual('Mighty Orbit');
  });
});
