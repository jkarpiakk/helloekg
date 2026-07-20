# Model serca 3D

`heart.glb` w tym katalogu zasila komponent `Hero3DHeart` — punkty chmury są próbkowane
z powierzchni tego mesha przez `MeshSurfaceSampler`.

## Pochodzenie i licencja

„Anatomically Correct Human Heart" autorstwa **Pigcraft**, licencja **CC BY 4.0**:
https://sketchfab.com/3d-models/anatomically-correct-human-heart-54fa880728d14c11afff78be8721620a

Atrybucja wymagana licencją jest w stopce aplikacji (`client/src/components/layout/Footer.tsx`).
Nie usuwaj jej przy zmianach w stopce.

## Jak powstał ten plik (69 MB → 806 kB)

Oryginał ze Sketchfaba ma ~1 mln trójkątów i komplet tekstur. Do próbkowania powierzchni
potrzebne są wyłącznie pozycje wierzchołków, więc reszta poszła precz:

1. **Najpierw** usuń wszystkie atrybuty poza `POSITION` oraz materiały i tekstury.
   To kluczowa kolejność — dopóki wierzchołki są rozdzielone przez UV i normalne,
   `weld` nie ma czego scalić, a `simplify` nie schodzi do zadanego współczynnika.
2. Potem `weld` (tolerancja 0.0001) i `simplify` do ~5% trójkątów (error 0.05).
3. Zapis bez kompresji — po odchudzeniu plik mieści się w budżecie 1,5 MB, dzięki czemu
   **nie trzeba serwować dekodera Draco ani meshopt**.

Normalne do cieniowania liczone są w przeglądarce (`computeVertexNormals`) — trzymanie ich
w pliku ponownie rozdziela wierzchołki i rozdmuchuje go do ~7 MB.

## Podmiana modelu

Komponent wykrywa najdłuższą oś z geometrii i normalizuje bryłę, ale **zwrotu osi nie zgaduje**:
pęk wielkich naczyń przy podstawie zwęża się podobnie jak koniuszek, więc automat mylił końce
i stawiał serce na głowie. Jeśli nowy model ma koniuszek po stronie maksimum najdłuższej osi,
przekaż `apexTowardAxisMin={false}` — bez edytowania komponentu.

Gdy pliku zabraknie, `Hero3DHeart` schodzi do geometrii proceduralnej i zgłasza to w konsoli.
