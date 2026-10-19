const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const stories = [
    {
      title: "The Whispering Woods",
      genre: "Mystery",
      coverUrl: "https://picsum.photos/seed/whispering/400/600",
      body: "Deep in the heart of the ancient forest, where the trees stood tall and the shadows grew long...",
      authorName: "Elena Vance",
      readingTime: 12,
      isFeatured: true,
    },
    {
      title: "Echoes of Silence",
      genre: "Fiction",
      coverUrl: "https://picsum.photos/seed/echoes/400/600",
      body: "The old clock on the mantelpiece ticked with a rhythmic insistence that seemed to fill the entire room...",
      authorName: "Marcus Thorne",
      readingTime: 8,
    },
    {
      title: "Midnight in Paris",
      genre: "Romance",
      coverUrl: "https://picsum.photos/seed/midnight/400/600",
      body: "The city of lights twinkled beneath them as they stood on the balcony of the small apartment...",
      authorName: "Sophie Laurent",
      readingTime: 15,
    },
    {
      title: "The Silent Witness",
      genre: "Thriller",
      coverUrl: "https://picsum.photos/seed/witness/400/600",
      body: "The courtroom was silent as the judge called for the next witness to step forward...",
      authorName: "Robert Black",
      readingTime: 10,
    },
    {
      title: "A Leap of Faith",
      genre: "Faith",
      coverUrl: "https://picsum.photos/seed/faith/400/600",
      body: "The path ahead was steep and narrow, winding through the rugged mountainside...",
      authorName: "David Shepherd",
      readingTime: 6,
    },
  ];

  for (const story of stories) {
    await prisma.story.create({
      data: story,
    });
  }

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
