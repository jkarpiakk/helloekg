# Model serca 3D — brakujący plik

`Hero3DHeart` próbkuje cząsteczki z pliku `/models/heart.glb`. **Tego pliku nie ma jeszcze w repo.**

## Dlaczego go brakuje

Model „Anatomically Correct Human Heart" (Pigcraft, CC BY 4.0) hostowany jest na Sketchfabie,
gdzie pobranie nawet darmowego modelu wymaga zalogowanego konta. Zautomatyzowane pobranie nie
było możliwe, więc plik musi wgrać człowiek.

## Jak uzupełnić

1. Zaloguj się na https://sketchfab.com i pobierz model w formacie glTF/GLB:
   https://sketchfab.com/3d-models/anatomically-correct-human-heart-54fa880728d14c11afff78be8721620a
2. Skompresuj do < 1,5 MB, np. przez gltf-transform:
   `npx @gltf-transform/cli optimize wejscie.glb heart.glb --compress draco --texture-compress webp`
   (model ma ~1 mln trójkątów — warto też `--simplify 0.3`; do próbkowania powierzchni
   gęsta siatka nie jest potrzebna)
3. Wrzuć wynik jako `client/public/models/heart.glb`.

Nic więcej nie trzeba zmieniać: komponent sprawdza obecność pliku i automatycznie przełącza się
z geometrii proceduralnej na próbkowanie `MeshSurfaceSampler` z realnego mesha.

## Atrybucja

Wymagana licencją i już obecna w stopce aplikacji (`client/src/components/layout/Footer.tsx`):
„Model serca 3D: Pigcraft, CC BY 4.0".
