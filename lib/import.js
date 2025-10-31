const importTsv1 = (tsv) => {
  const table = tsv.split("\n").map((row) => row.split("\t"));

  const metadata = {
    title: table[3][1],
    author: { text: table[4][1], url: table[5][1] },
    shuffle: true,
    ...(table[6][1] ? { description: table[6][1] } : {}),
  };

  const problems = table.slice(12).map((row) => ({
    body: row[0],
    answers: row[1].split(",").map((str) => str.trim().toLowerCase()),
    displayAnswer: row[2],
    ...(row[3] ? { explanation: row[3] } : {}),
  }));

  return { ...metadata, problems };
};
