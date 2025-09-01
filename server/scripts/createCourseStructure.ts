import { db } from "../db";
import { modules, sections } from "@shared/schema";

const courseStructure = [
  {
    title: "Wprowadzenie do EKG",
    description: "Podstawy układu bodźcoprzewodzącego serca. Odprowadzenia kończynowe i przedsercowe. Określanie rytmu serca i częstości akcji serca. Ocena osi elektrycznej serca.",
    order: 1,
    sections: [
      {
        title: "Podstawy układu bodźcoprzewodzącego serca",
        description: "Węzeł zatokowy, przewodzenie przez przedsionki, węzeł AV",
        order: 1
      },
      {
        title: "Odprowadzenia kończynowe i przedsercowe",
        description: "12 odprowadzeń EKG i ich anatomiczne umiejscowienie",
        order: 2
      },
      {
        title: "Określanie rytmu serca i częstości akcji serca",
        description: "Metoda 300, analiza regularności rytmu",
        order: 3
      },
      {
        title: "Ocena osi elektrycznej serca",
        description: "Normalna oś serca, odchylenia w lewo i prawo",
        order: 4
      }
    ]
  },
  {
    title: "Załamki, odcinki i odstępy",
    description: "Szczegółowa analiza każdego elementu zapisu EKG - od załamka P przez zespół QRS po załamek T.",
    order: 2,
    sections: [
      {
        title: "Załamek P i ocena przedsionków",
        description: "Depolaryzacja przedsionków, morfologia załamka P",
        order: 1
      },
      {
        title: "Odstęp PQ i funkcja węzła AV",
        description: "Przewodzenie przedsionkowo-komorowe, bloki AV",
        order: 2
      },
      {
        title: "Zespół QRS i depolaryzacja komór",
        description: "Morfologia QRS, szerokość zespołu, aberracje",
        order: 3
      },
      {
        title: "Odcinek ST i załamek T – rozpoznawanie niedokrwienia",
        description: "Repolaryzacja komór, zmiany niedokrwienne",
        order: 4
      },
      {
        title: "Ocena odstępu QT",
        description: "Wydłużenie QT, ryzyko arytmii komorowych",
        order: 5
      }
    ]
  },
  {
    title: "Przerosty i niedokrwienie",
    description: "Rozpoznawanie przerostów komór i niedokrwienia mięśnia sercowego na podstawie zapisów EKG.",
    order: 3,
    sections: [
      {
        title: "Przerost lewej komory – kryteria i analiza EKG",
        description: "Kryteria Sokolowa-Lyona, Cornell, inne wskaźniki",
        order: 1
      },
      {
        title: "Przerost prawej komory – kluczowe cechy",
        description: "Wysokie R w V1, odchylenie osi w prawo",
        order: 2
      },
      {
        title: "Niedokrwienie mięśnia sercowego – obniżenie i uniesienie ST",
        description: "Zmiany niedokrwienne, różnicowanie z innymi stanami",
        order: 3
      },
      {
        title: "Rozpoznawanie zawałów – STEMI i NSTEMI",
        description: "Ostre zespoły wieńcowe, kryteria diagnostyczne",
        order: 4
      },
      {
        title: "Topografia zawałów serca na EKG",
        description: "Lokalizacja zmian w zależności od naczynia wieńcowego",
        order: 5
      }
    ]
  },
  {
    title: "Arytmie i zaburzenia rytmu serca",
    description: "Kompleksowa analiza wszystkich rodzajów arytmii - od łagodnych do zagrażających życiu.",
    order: 4,
    sections: [
      {
        title: "Tachyarytmie nadkomorowe: AVNRT, AVRT",
        description: "Częstoskurcze z wąskimi zespołami QRS",
        order: 1
      },
      {
        title: "Migotanie i trzepotanie przedsionków",
        description: "Nieregularne rytmy nadkomorowe, stratyfikacja ryzyka",
        order: 2
      },
      {
        title: "Bradyarytmie: zaburzenia węzła zatokowego",
        description: "Bradykardia zatokowa, sick sinus syndrome",
        order: 3
      },
      {
        title: "Częstoskurcze komorowe i migotanie komór",
        description: "Arytmie zagrażające życiu, VT vs SVT",
        order: 4
      },
      {
        title: "Mechanizmy powstawania arytmii – re-entry, automatyzm",
        description: "Patofizjologia arytmii, diagnostyka różnicowa",
        order: 5
      }
    ]
  },
  {
    title: "Bloki przewodzenia",
    description: "Systematyczna analiza zaburzeń przewodzenia w sercu - od bloku AV po bloki śródkomorowe.",
    order: 5,
    sections: [
      {
        title: "Blok przedsionkowo-komorowy I stopnia",
        description: "Wydłużenie odstępu PQ, interpretacja kliniczna",
        order: 1
      },
      {
        title: "Blok AV II stopnia typu Mobitz I (Wenckebach)",
        description: "Progresywne wydłużanie PQ, wypadanie QRS",
        order: 2
      },
      {
        title: "Blok AV II stopnia typu Mobitz II",
        description: "Nagłe wypadanie QRS, większe ryzyko",
        order: 3
      },
      {
        title: "Blok AV III stopnia",
        description: "Całkowita dysocjacja przedsionkowo-komorowa",
        order: 4
      },
      {
        title: "Zaburzenia przewodzenia śródkomorowego (RBBB, LBBB)",
        description: "Bloki odnóg pęczka Hisa, bloki wiązek",
        order: 5
      }
    ]
  },
  {
    title: "Stymulatory serca i urządzenia wszczepialne",
    description: "Interpretacja zapisów EKG u pacjentów z urządzeniami wszczepialnymi.",
    order: 6,
    sections: [
      {
        title: "Zasady działania stymulatorów serca",
        description: "Rodzaje stymulatorów, kodowanie NBG",
        order: 1
      },
      {
        title: "EKG ze stymulatorem przedsionkowym, komorowym i dwukomorowym",
        description: "Charakterystyczne zmiany w zapisie EKG",
        order: 2
      },
      {
        title: "Rozpoznawanie i diagnostyka problemów ze stymulatorem",
        description: "Dysfunkcje stymulatorów, brak stymulacji",
        order: 3
      },
      {
        title: "ICD (kardiowertery-defibrylatory wszczepialne) – zapis na EKG",
        description: "Funkcje ICD, artefakty na EKG",
        order: 4
      }
    ]
  },
  {
    title: "Analiza przypadków klinicznych",
    description: "Praktyczne zastosowanie wiedzy w rzeczywistych scenariuszach klinicznych.",
    order: 7,
    sections: [
      {
        title: "Interpretacja 10 przykładowych zapisów EKG",
        description: "Kompleksowa analiza rzeczywistych przypadków",
        order: 1
      },
      {
        title: "Podejście do pacjenta z bólem w klatce piersiowej",
        description: "Algorytm diagnostyczny, ostre zespoły wieńcowe",
        order: 2
      },
      {
        title: "Pacjent z kołataniem serca – różnicowanie arytmii",
        description: "Strategia diagnostyczna w arytmiach",
        order: 3
      },
      {
        title: "Pacjent z omdleniami – ocena bloku przewodzenia",
        description: "Diagnostyka zaburzeń przewodzenia",
        order: 4
      },
      {
        title: "Rozpoznawanie groźnych stanów – migotanie komór, STEMI",
        description: "Stany zagrażające życiu, postępowanie nagłe",
        order: 5
      }
    ]
  }
];

export async function createCourseStructure() {
  console.log("🏗️ Tworzenie struktury kursu EKG...");
  
  try {
    // Clear existing data (if any)
    await db.delete(sections);
    await db.delete(modules);
    
    // Create modules and sections
    for (const moduleData of courseStructure) {
      console.log(`📚 Tworzenie modułu: ${moduleData.title}`);
      
      // Create module
      const [module] = await db.insert(modules).values({
        title: moduleData.title,
        description: moduleData.description,
        order: moduleData.order,
        isLocked: moduleData.order > 1 // Lock all modules except the first one
      }).returning();
      
      // Create sections for this module
      for (const sectionData of moduleData.sections) {
        console.log(`  📝 Dodawanie sekcji: ${sectionData.title}`);
        
        await db.insert(sections).values({
          moduleId: module.id,
          title: sectionData.title,
          description: sectionData.description,
          order: sectionData.order,
          isLocked: false // Sections within a module are unlocked
        });
      }
    }
    
    console.log("✅ Struktura kursu została utworzona pomyślnie!");
    console.log(`📊 Utworzono ${courseStructure.length} modułów z ${courseStructure.reduce((total, m) => total + m.sections.length, 0)} sekcjami`);
    
  } catch (error) {
    console.error("❌ Błąd podczas tworzenia struktury kursu:", error);
    throw error;
  }
}

// Run the script
createCourseStructure()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });