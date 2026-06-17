<?php
namespace App\Domain\Services;

class GlossaryService
{
    private array $terms;

    public function __construct()
    {
        $this->terms = [
            'DF' => [
                'es' => [
                    'name' => 'Dependencia Funcional',
                    'short' => 'DF',
                    'definition' => 'Una dependencia funcional X → Y significa que el valor de X determina unívocamente el valor de Y. Si dos filas tienen el mismo X, entonces también deben tener el mismo Y.',
                    'example' => 'id_estudiante → nombre_estudiante (el ID del estudiante determina su nombre)',
                    'analogy' => 'Como el número de cédula determina a la persona: cada cédula corresponde a una única persona.',
                    'symbol' => 'X → Y',
                    'related_terms' => ['Clave candidata', 'Determinante', 'Dependiente'],
                    'difficulty' => 'basic',
                ],
                'en' => [
                    'name' => 'Functional Dependency',
                    'short' => 'FD',
                    'definition' => 'A functional dependency X → Y means that the value of X uniquely determines the value of Y. If two rows have the same X, they must also have the same Y.',
                    'example' => 'student_id → student_name (the student ID determines the student name)',
                    'analogy' => 'Like an ID number determines a person: each ID corresponds to a single person.',
                    'symbol' => 'X → Y',
                    'related_terms' => ['Candidate Key', 'Determinant', 'Dependent'],
                    'difficulty' => 'basic',
                ],
                'pt-BR' => [
                    'name' => 'Dependência Funcional',
                    'short' => 'DF',
                    'definition' => 'Uma dependência funcional X → Y significa que o valor de X determina exclusivamente o valor de Y.',
                    'example' => 'id_aluno → nome_aluno',
                    'analogy' => 'Como o CPF determina a pessoa.',
                    'symbol' => 'X → Y',
                    'related_terms' => ['Chave Candidata', 'Determinante', 'Dependente'],
                    'difficulty' => 'basic',
                ],
            ],
            'Determinante' => [
                'es' => [
                    'name' => 'Determinante',
                    'short' => 'Det',
                    'definition' => 'El lado izquierdo de una dependencia funcional (X en X → Y). El determinante es el atributo o conjunto de atributos que determina el valor de otro atributo.',
                    'example' => 'En id_estudiante → nombre_estudiante, id_estudiante es el determinante.',
                    'analogy' => 'Como la llave de un casillero: introduces la llave correcta (determinante) y obtienes el contenido (dependiente).',
                    'symbol' => 'X en X → Y',
                    'related_terms' => ['DF', 'Dependiente', 'Clave candidata'],
                    'difficulty' => 'basic',
                ],
                'en' => [
                    'name' => 'Determinant',
                    'short' => 'Det',
                    'definition' => 'The left-hand side of a functional dependency (X in X → Y). The determinant is the attribute or set of attributes that determines the value of another attribute.',
                    'example' => 'In student_id → student_name, student_id is the determinant.',
                    'analogy' => 'Like a locker key: insert the correct key (determinant) and get the contents (dependent).',
                    'symbol' => 'X in X → Y',
                    'related_terms' => ['FD', 'Dependent', 'Candidate Key'],
                    'difficulty' => 'basic',
                ],
                'pt-BR' => [
                    'name' => 'Determinante',
                    'short' => 'Det',
                    'definition' => 'O lado esquerdo de uma dependência funcional (X em X → Y).',
                    'example' => 'Em id_aluno → nome_aluno, id_aluno é o determinante.',
                    'analogy' => 'Como a chave de um armário.',
                    'symbol' => 'X em X → Y',
                    'related_terms' => ['DF', 'Dependente', 'Chave Candidata'],
                    'difficulty' => 'basic',
                ],
            ],
            'Dependiente' => [
                'es' => [
                    'name' => 'Dependiente',
                    'short' => 'Dep',
                    'definition' => 'El lado derecho de una dependencia funcional (Y en X → Y). Es el atributo cuyo valor está determinado por el determinante.',
                    'example' => 'En id_estudiante → nombre_estudiante, nombre_estudiante es el dependiente.',
                    'analogy' => 'Como el contenido del casillero que se obtiene al usar la llave correcta.',
                    'symbol' => 'Y en X → Y',
                    'related_terms' => ['DF', 'Determinante', 'Atributo'],
                    'difficulty' => 'basic',
                ],
                'en' => [
                    'name' => 'Dependent',
                    'short' => 'Dep',
                    'definition' => 'The right-hand side of a functional dependency (Y in X → Y). The attribute whose value is determined by the determinant.',
                    'example' => 'In student_id → student_name, student_name is the dependent.',
                    'analogy' => 'Like the locker contents obtained by using the correct key.',
                    'symbol' => 'Y in X → Y',
                    'related_terms' => ['FD', 'Determinant', 'Attribute'],
                    'difficulty' => 'basic',
                ],
                'pt-BR' => [
                    'name' => 'Dependente',
                    'short' => 'Dep',
                    'definition' => 'O lado direito de uma dependência funcional (Y em X → Y).',
                    'example' => 'Em id_aluno → nome_aluno, nome_aluno é o dependente.',
                    'analogy' => 'Como o conteúdo do armário.',
                    'symbol' => 'Y em X → Y',
                    'related_terms' => ['DF', 'Determinante', 'Atributo'],
                    'difficulty' => 'basic',
                ],
            ],
            'Atributo' => [
                'es' => [
                    'name' => 'Atributo',
                    'short' => 'Attr',
                    'definition' => 'Una columna en una tabla de base de datos. Representa una propiedad o característica de la entidad modelada.',
                    'example' => 'En una tabla Estudiante, los atributos pueden ser: id_estudiante, nombre, apellido, fecha_nacimiento.',
                    'analogy' => 'Como los campos en un formulario: cada campo (atributo) pide un dato específico.',
                    'symbol' => 'A₁, A₂, ..., Aₙ',
                    'related_terms' => ['Tupla', 'Relación', 'Dominio'],
                    'difficulty' => 'basic',
                ],
                'en' => [
                    'name' => 'Attribute',
                    'short' => 'Attr',
                    'definition' => 'A column in a database table. Represents a property or characteristic of the modeled entity.',
                    'example' => 'In a Student table, attributes can be: student_id, first_name, last_name, birth_date.',
                    'analogy' => 'Like fields in a form: each field (attribute) asks for specific information.',
                    'symbol' => 'A₁, A₂, ..., Aₙ',
                    'related_terms' => ['Tuple', 'Relation', 'Domain'],
                    'difficulty' => 'basic',
                ],
                'pt-BR' => [
                    'name' => 'Atributo',
                    'short' => 'Attr',
                    'definition' => 'Uma coluna em uma tabela de banco de dados.',
                    'example' => 'Em uma tabela Aluno: id_aluno, nome, data_nascimento.',
                    'analogy' => 'Como os campos em um formulário.',
                    'symbol' => 'A₁, A₂, ..., Aₙ',
                    'related_terms' => ['Tupla', 'Relação', 'Domínio'],
                    'difficulty' => 'basic',
                ],
            ],
            'Tupla' => [
                'es' => [
                    'name' => 'Tupla',
                    'short' => 'Tuple',
                    'definition' => 'Una fila en una tabla de base de datos. Representa una instancia específica de la entidad con valores concretos para cada atributo.',
                    'example' => 'En la tabla Estudiante, una tupla sería: (1, "Ana", "García", "2000-05-15").',
                    'analogy' => 'Como una ficha de un archivo: cada ficha (tupla) contiene toda la información de una persona.',
                    'symbol' => '(a₁, a₂, ..., aₙ)',
                    'related_terms' => ['Atributo', 'Relación', 'Tabla'],
                    'difficulty' => 'basic',
                ],
                'en' => [
                    'name' => 'Tuple',
                    'short' => 'Tuple',
                    'definition' => 'A row in a database table. Represents a specific instance of the entity with concrete values for each attribute.',
                    'example' => 'In the Student table, a tuple would be: (1, "John", "Doe", "2000-05-15").',
                    'analogy' => 'Like a file card: each card (tuple) contains all the information about one person.',
                    'symbol' => '(a₁, a₂, ..., aₙ)',
                    'related_terms' => ['Attribute', 'Relation', 'Table'],
                    'difficulty' => 'basic',
                ],
                'pt-BR' => [
                    'name' => 'Tupla',
                    'short' => 'Tupla',
                    'definition' => 'Uma linha em uma tabela de banco de dados.',
                    'example' => 'Na tabela Aluno: (1, "Maria", "Silva", "2000-05-15").',
                    'analogy' => 'Como uma ficha de arquivo.',
                    'symbol' => '(a₁, a₂, ..., aₙ)',
                    'related_terms' => ['Atributo', 'Relação', 'Tabela'],
                    'difficulty' => 'basic',
                ],
            ],
            'Relacion' => [
                'es' => [
                    'name' => 'Relación',
                    'short' => 'R',
                    'definition' => 'En el modelo relacional, una relación es una tabla compuesta por un conjunto de tuplas con los mismos atributos. Formalmente es un subconjunto del producto cartesiano de dominios.',
                    'example' => 'La relación Estudiante(estudiante_id, nombre, apellido) contiene todas las tuplas de estudiantes.',
                    'analogy' => 'Como una hoja de cálculo: las columnas son atributos y las filas son tuplas.',
                    'symbol' => 'R(A₁, A₂, ..., Aₙ)',
                    'related_terms' => ['Tupla', 'Atributo', 'Esquema'],
                    'difficulty' => 'basic',
                ],
                'en' => [
                    'name' => 'Relation',
                    'short' => 'R',
                    'definition' => 'In the relational model, a relation is a table composed of a set of tuples with the same attributes. Formally it is a subset of the Cartesian product of domains.',
                    'example' => 'The Student(student_id, first_name, last_name) relation contains all student tuples.',
                    'analogy' => 'Like a spreadsheet: columns are attributes and rows are tuples.',
                    'symbol' => 'R(A₁, A₂, ..., Aₙ)',
                    'related_terms' => ['Tuple', 'Attribute', 'Schema'],
                    'difficulty' => 'basic',
                ],
                'pt-BR' => [
                    'name' => 'Relação',
                    'short' => 'R',
                    'definition' => 'No modelo relacional, uma relação é uma tabela composta por tuplas com os mesmos atributos.',
                    'example' => 'A relação Aluno(id_aluno, nome, sobrenome).',
                    'analogy' => 'Como uma planilha.',
                    'symbol' => 'R(A₁, A₂, ..., Aₙ)',
                    'related_terms' => ['Tupla', 'Atributo', 'Esquema'],
                    'difficulty' => 'basic',
                ],
            ],
            'ClavePrimaria' => [
                'es' => [
                    'name' => 'Clave Primaria',
                    'short' => 'PK',
                    'definition' => 'Atributo o conjunto de atributos que identifica de manera única cada tupla en una relación. No puede tener valores NULL ni repetidos.',
                    'example' => 'En una tabla Estudiante, id_estudiante es la clave primaria porque identifica unívocamente a cada estudiante.',
                    'analogy' => 'Como el número de cédula: identifica a cada persona de forma única e irrepetible.',
                    'symbol' => 'PK(subrayado)',
                    'related_terms' => ['Clave candidata', 'Clave foránea', 'Superclave'],
                    'difficulty' => 'basic',
                ],
                'en' => [
                    'name' => 'Primary Key',
                    'short' => 'PK',
                    'definition' => 'An attribute or set of attributes that uniquely identifies each tuple in a relation. Cannot contain NULL or duplicate values.',
                    'example' => 'In a Student table, student_id is the primary key because it uniquely identifies each student.',
                    'analogy' => 'Like a national ID number: uniquely identifies each person.',
                    'symbol' => 'PK(underlined)',
                    'related_terms' => ['Candidate Key', 'Foreign Key', 'Superkey'],
                    'difficulty' => 'basic',
                ],
                'pt-BR' => [
                    'name' => 'Chave Primária',
                    'short' => 'PK',
                    'definition' => 'Atributo que identifica cada tupla de forma única.',
                    'example' => 'Em Aluno, id_aluno é a chave primária.',
                    'analogy' => 'Como o CPF.',
                    'symbol' => 'PK(sublinhado)',
                    'related_terms' => ['Chave Candidata', 'Chave Estrangeira', 'Superchave'],
                    'difficulty' => 'basic',
                ],
            ],
            'ClaveForanea' => [
                'es' => [
                    'name' => 'Clave Foránea',
                    'short' => 'FK',
                    'definition' => 'Atributo o conjunto de atributos en una relación que referencia la clave primaria de otra relación. Establece relaciones entre tablas.',
                    'example' => 'En una tabla Inscripción, id_estudiante es una clave foránea que referencia id_estudiante en la tabla Estudiante.',
                    'analogy' => 'Como el número de expediente de un paciente en la consulta del médico: te permite buscar los detalles del paciente en otro archivo.',
                    'symbol' => 'FK → PK(referenciada)',
                    'related_terms' => ['Clave primaria', 'Relación', 'Join'],
                    'difficulty' => 'basic',
                ],
                'en' => [
                    'name' => 'Foreign Key',
                    'short' => 'FK',
                    'definition' => 'An attribute or set of attributes in one relation that references the primary key of another relation. Establishes relationships between tables.',
                    'example' => 'In an Enrollment table, student_id is a foreign key referencing student_id in the Student table.',
                    'analogy' => 'Like a patient\'s file number at a doctor\'s office: it lets you look up patient details in another file.',
                    'symbol' => 'FK → PK(referenced)',
                    'related_terms' => ['Primary Key', 'Relation', 'Join'],
                    'difficulty' => 'basic',
                ],
                'pt-BR' => [
                    'name' => 'Chave Estrangeira',
                    'short' => 'FK',
                    'definition' => 'Atributo que referencia a chave primária de outra relação.',
                    'example' => 'Em Matrícula, id_aluno é chave estrangeira.',
                    'analogy' => 'Como o número do prontuário.',
                    'symbol' => 'FK → PK(referenciada)',
                    'related_terms' => ['Chave Primária', 'Relação', 'Join'],
                    'difficulty' => 'basic',
                ],
            ],
            'Esquema' => [
                'es' => [
                    'name' => 'Esquema',
                    'short' => 'Sch',
                    'definition' => 'La estructura o definición de una relación, incluyendo su nombre y el conjunto de atributos con sus dominios. No incluye los datos, solo la definición.',
                    'example' => 'Esquema Estudiante(estudiante_id: INT, nombre: VARCHAR(100), fecha_nac: DATE)',
                    'analogy' => 'Como el molde de una galleta: define la forma (estructura) sin importar la masa (datos).',
                    'symbol' => 'R(A₁:D₁, A₂:D₂, ..., Aₙ:Dₙ)',
                    'related_terms' => ['Relación', 'Atributo', 'Tabla'],
                    'difficulty' => 'basic',
                ],
                'en' => [
                    'name' => 'Schema',
                    'short' => 'Sch',
                    'definition' => 'The structure or definition of a relation, including its name and set of attributes with their domains. Does not include data, only the definition.',
                    'example' => 'Schema Student(student_id: INT, name: VARCHAR(100), birth_date: DATE)',
                    'analogy' => 'Like a cookie cutter: defines the shape (structure) regardless of the dough (data).',
                    'symbol' => 'R(A₁:D₁, A₂:D₂, ..., Aₙ:Dₙ)',
                    'related_terms' => ['Relation', 'Attribute', 'Table'],
                    'difficulty' => 'basic',
                ],
                'pt-BR' => [
                    'name' => 'Esquema',
                    'short' => 'Sch',
                    'definition' => 'A estrutura de uma relação com nome e atributos.',
                    'example' => 'Esquema Aluno(id_aluno: INT, nome: VARCHAR(100))',
                    'analogy' => 'Como a forma de um biscoito.',
                    'symbol' => 'R(A₁:D₁, A₂:D₂, ..., Aₙ:Dₙ)',
                    'related_terms' => ['Relação', 'Atributo', 'Tabela'],
                    'difficulty' => 'basic',
                ],
            ],
            'Tabla' => [
                'es' => [
                    'name' => 'Tabla',
                    'short' => 'T',
                    'definition' => 'Término práctico equivalente a relación en el modelo relacional. Una tabla organiza datos en filas (tuplas) y columnas (atributos).',
                    'example' => 'La tabla "Estudiante" con columnas id, nombre, ciudad y filas con los datos de cada estudiante.',
                    'analogy' => 'Como un archivador: cada carpeta (fila) contiene datos de una entidad, y cada separador (columna) es un tipo de dato.',
                    'symbol' => 'Tabla(Atributo₁, ..., Atributoₙ)',
                    'related_terms' => ['Relación', 'Tupla', 'Esquema'],
                    'difficulty' => 'basic',
                ],
                'en' => [
                    'name' => 'Table',
                    'short' => 'T',
                    'definition' => 'Practical term equivalent to relation in the relational model. A table organizes data in rows (tuples) and columns (attributes).',
                    'example' => 'The "Student" table with columns id, name, city and rows with each student\'s data.',
                    'analogy' => 'Like a filing cabinet: each folder (row) contains entity data, each divider (column) is a data type.',
                    'symbol' => 'Table(Attribute₁, ..., Attributeₙ)',
                    'related_terms' => ['Relation', 'Tuple', 'Schema'],
                    'difficulty' => 'basic',
                ],
                'pt-BR' => [
                    'name' => 'Tabela',
                    'short' => 'T',
                    'definition' => 'Termo prático equivalente a relação no modelo relacional.',
                    'example' => 'A tabela "Aluno" com colunas id, nome, cidade.',
                    'analogy' => 'Como um arquivo.',
                    'symbol' => 'Tabela(Atributo₁, ..., Atributoₙ)',
                    'related_terms' => ['Relação', 'Tupla', 'Esquema'],
                    'difficulty' => 'basic',
                ],
            ],
            '1FN' => [
                'es' => [
                    'name' => 'Primera Forma Normal',
                    'short' => '1FN',
                    'definition' => 'Una tabla está en 1FN si todos sus atributos contienen valores atómicos (indivisibles) y no hay grupos repetitivos.',
                    'example' => 'NO: telefonos VARCHAR(100) con "555-0100,555-0200"\nSÍ: crear tabla separada Telefono(estudiante_id, telefono)',
                    'analogy' => 'Como una agenda donde cada número de teléfono tiene su propia línea en lugar de escribir varios en el mismo espacio.',
                    'symbol' => 'Atributos atómicos',
                    'related_terms' => ['Atómico', 'Grupo repetitivo', 'Normalización'],
                    'difficulty' => 'intermediate',
                ],
                'en' => [
                    'name' => 'First Normal Form',
                    'short' => '1NF',
                    'definition' => 'A table is in 1NF if all attributes contain atomic (indivisible) values and there are no repeating groups.',
                    'example' => 'NOT: phones VARCHAR(100) with "555-0100,555-0200"\nYES: create separate Phone(student_id, phone) table',
                    'analogy' => 'Like an address book where each phone number has its own line.',
                    'symbol' => 'Atomic attributes',
                    'related_terms' => ['Atomic', 'Repeating group', 'Normalization'],
                    'difficulty' => 'intermediate',
                ],
                'pt-BR' => [
                    'name' => 'Primeira Forma Normal',
                    'short' => '1FN',
                    'definition' => 'Uma tabela está na 1FN se todos os atributos contêm valores atômicos.',
                    'example' => 'NÃO: telefones VARCHAR(100)\nSIM: criar tabela Telefone(aluno_id, telefone)',
                    'analogy' => 'Como uma agenda onde cada telefone tem sua própria linha.',
                    'symbol' => 'Atributos atômicos',
                    'related_terms' => ['Atômico', 'Grupo repetitivo', 'Normalização'],
                    'difficulty' => 'intermediate',
                ],
            ],
            '2FN' => [
                'es' => [
                    'name' => 'Segunda Forma Normal',
                    'short' => '2FN',
                    'definition' => 'Una tabla está en 2FN si está en 1FN y todos los atributos no clave dependen funcionalmente de toda la clave candidata, no solo de una parte (no hay dependencias parciales).',
                    'example' => 'NO: Inscripción(estudiante_id, curso_id, nombre_estudiante, nota)\nSÍ: separar en Estudiante(estudiante_id, nombre) e Inscripción(estudiante_id, curso_id, nota)',
                    'analogy' => 'Como una biblioteca donde cada libro tiene una ficha con todos sus datos, sin mezclar información que solo depende del autor en la ficha del libro.',
                    'symbol' => '1FN + sin dependencias parciales',
                    'related_terms' => ['1FN', 'Dependencia parcial', 'Clave candidata'],
                    'difficulty' => 'intermediate',
                ],
                'en' => [
                    'name' => 'Second Normal Form',
                    'short' => '2NF',
                    'definition' => 'A table is in 2NF if it is in 1NF and every non-key attribute is fully functionally dependent on the entire candidate key (no partial dependencies).',
                    'example' => 'NOT: Enrollment(student_id, course_id, student_name, grade)\nYES: separate into Student(student_id, name) and Enrollment(student_id, course_id, grade)',
                    'analogy' => 'Like a library where each book card has all its data, without mixing author-only info on the book card.',
                    'symbol' => '1NF + no partial dependencies',
                    'related_terms' => ['1NF', 'Partial dependency', 'Candidate key'],
                    'difficulty' => 'intermediate',
                ],
                'pt-BR' => [
                    'name' => 'Segunda Forma Normal',
                    'short' => '2FN',
                    'definition' => 'Uma tabela está na 2FN se está na 1FN e não há dependências parciais.',
                    'example' => 'NÃO: Matrícula(aluno_id, curso_id, nome_aluno, nota)',
                    'analogy' => 'Como uma biblioteca organizada.',
                    'symbol' => '1FN + sem dependências parciais',
                    'related_terms' => ['1FN', 'Dependência parcial', 'Chave candidata'],
                    'difficulty' => 'intermediate',
                ],
            ],
            '3FN' => [
                'es' => [
                    'name' => 'Tercera Forma Normal',
                    'short' => '3FN',
                    'definition' => 'Una tabla está en 3FN si está en 2FN y ningún atributo no clave depende transitivamente de una clave candidata.',
                    'example' => 'NO: Empleado(emp_id, depto_id, depto_nombre, edificio)\nSÍ: Empleado(emp_id, depto_id) y Depto(depto_id, depto_nombre, edificio)',
                    'analogy' => 'Como no tener que preguntarle al vecino el nombre de su calle: si sabes el código postal, no deberías necesitar otra tabla para saber la ciudad.',
                    'symbol' => '2FN + sin dependencias transitivas',
                    'related_terms' => ['2FN', 'Dependencia transitiva', 'Atributo no clave'],
                    'difficulty' => 'intermediate',
                ],
                'en' => [
                    'name' => 'Third Normal Form',
                    'short' => '3NF',
                    'definition' => 'A table is in 3NF if it is in 2NF and no non-key attribute is transitively dependent on a candidate key.',
                    'example' => 'NOT: Employee(emp_id, dept_id, dept_name, building)\nYES: Employee(emp_id, dept_id) and Dept(dept_id, dept_name, building)',
                    'analogy' => 'Like not having to ask the neighbor for their street name: if you know the zip code, you should not need another table to know the city.',
                    'symbol' => '2NF + no transitive dependencies',
                    'related_terms' => ['2NF', 'Transitive dependency', 'Non-key attribute'],
                    'difficulty' => 'intermediate',
                ],
                'pt-BR' => [
                    'name' => 'Terceira Forma Normal',
                    'short' => '3FN',
                    'definition' => 'Uma tabela está na 3FN se está na 2FN e não há dependências transitivas.',
                    'example' => 'NÃO: Funcionário(func_id, depto_id, depto_nome)',
                    'analogy' => 'Como não perguntar ao vizinho o nome da rua.',
                    'symbol' => '2FN + sem dependências transitivas',
                    'related_terms' => ['2FN', 'Dependência transitiva', 'Atributo não chave'],
                    'difficulty' => 'intermediate',
                ],
            ],
            'BCNF' => [
                'es' => [
                    'name' => 'Forma Normal de Boyce-Codd',
                    'short' => 'BCNF',
                    'definition' => 'Una tabla está en BCNF si para toda dependencia funcional no trivial X → Y, X es una superclave. Es una versión más estricta de 3FN.',
                    'example' => 'NO: R(A, B, C) con AB → C y C → B (C no es superclave)\nSÍ: descomponer en R1(A, C) y R2(C, B)',
                    'analogy' => 'Como un aeropuerto donde solo los pilotos con licencia (superclave) pueden operar cada avión. Nadie sin la licencia adecuada puede tomar decisiones.',
                    'symbol' => '∀(X → Y): X es superclave',
                    'related_terms' => ['3FN', 'Superclave', 'Determinante', 'Descomposición BCNF'],
                    'difficulty' => 'intermediate',
                ],
                'en' => [
                    'name' => 'Boyce-Codd Normal Form',
                    'short' => 'BCNF',
                    'definition' => 'A table is in BCNF if for every non-trivial functional dependency X → Y, X is a superkey. It is a stricter version of 3NF.',
                    'example' => 'NOT: R(A, B, C) with AB → C and C → B (C is not a superkey)\nYES: decompose into R1(A, C) and R2(C, B)',
                    'analogy' => 'Like an airport where only licensed pilots (superkey) can operate each plane. No one without proper licensing can make decisions.',
                    'symbol' => '∀(X → Y): X is superkey',
                    'related_terms' => ['3NF', 'Superkey', 'Determinant', 'BCNF decomposition'],
                    'difficulty' => 'intermediate',
                ],
                'pt-BR' => [
                    'name' => 'Forma Normal de Boyce-Codd',
                    'short' => 'BCNF',
                    'definition' => 'Uma tabela está na BCNF se para toda dependência funcional não trivial X → Y, X é uma superchave.',
                    'example' => 'NÃO: R(A, B, C) com AB → C e C → B',
                    'analogy' => 'Como um aeroporto onde só pilotos licenciados operam.',
                    'symbol' => '∀(X → Y): X é superchave',
                    'related_terms' => ['3FN', 'Superchave', 'Determinante', 'Decomposição BCNF'],
                    'difficulty' => 'intermediate',
                ],
            ],
            'DependenciaParcial' => [
                'es' => [
                    'name' => 'Dependencia Parcial',
                    'short' => 'DP',
                    'definition' => 'Ocurre cuando un atributo no clave depende de un subconjunto propio de una clave candidata, no de la clave completa. Viola 2FN.',
                    'example' => 'En Inscripción(estudiante_id, curso_id, nombre_estudiante), nombre_estudiante depende solo de estudiante_id (parte de la clave {estudiante_id, curso_id}).',
                    'analogy' => 'Como un empleado que reporta a un subgerente en lugar de al gerente general: la información llega incompleta.',
                    'symbol' => 'X ⊂ CK → Y (Y no clave)',
                    'related_terms' => ['2FN', 'Dependencia transitiva', 'Clave candidata'],
                    'difficulty' => 'intermediate',
                ],
                'en' => [
                    'name' => 'Partial Dependency',
                    'short' => 'PD',
                    'definition' => 'Occurs when a non-key attribute depends on a proper subset of a candidate key, not the full key. Violates 2NF.',
                    'example' => 'In Enrollment(student_id, course_id, student_name), student_name depends only on student_id (part of key {student_id, course_id}).',
                    'analogy' => 'Like an employee reporting to an assistant manager instead of the general manager: information arrives incomplete.',
                    'symbol' => 'X ⊂ CK → Y (Y non-key)',
                    'related_terms' => ['2NF', 'Transitive dependency', 'Candidate key'],
                    'difficulty' => 'intermediate',
                ],
                'pt-BR' => [
                    'name' => 'Dependência Parcial',
                    'short' => 'DP',
                    'definition' => 'Quando um atributo não chave depende de um subconjunto próprio de uma chave candidata.',
                    'example' => 'Em Matrícula(aluno_id, curso_id, nome_aluno).',
                    'analogy' => 'Como um funcionário que reporta a um subgerente.',
                    'symbol' => 'X ⊂ CK → Y (Y não chave)',
                    'related_terms' => ['2FN', 'Dependência transitiva', 'Chave candidata'],
                    'difficulty' => 'intermediate',
                ],
            ],
            'DependenciaTransitiva' => [
                'es' => [
                    'name' => 'Dependencia Transitiva',
                    'short' => 'DT',
                    'definition' => 'Ocurre cuando un atributo no clave depende de otro atributo no clave, creando una cadena CK → A → B donde B no es clave. Viola 3FN.',
                    'example' => 'En Empleado(emp_id, depto_id, depto_nombre), depto_nombre depende de depto_id que no es clave, creando transitividad desde emp_id.',
                    'analogy' => 'Como enterarte de una noticia a través de un amigo de un amigo: la información puede distorsionarse en el camino.',
                    'symbol' => 'CK → A → B (A, B no clave)',
                    'related_terms' => ['3FN', 'Dependencia parcial', 'Atributo no clave'],
                    'difficulty' => 'intermediate',
                ],
                'en' => [
                    'name' => 'Transitive Dependency',
                    'short' => 'TD',
                    'definition' => 'Occurs when a non-key attribute depends on another non-key attribute, creating a chain CK → A → B where B is not a key. Violates 3NF.',
                    'example' => 'In Employee(emp_id, dept_id, dept_name), dept_name depends on dept_id which is not a key, creating transitivity from emp_id.',
                    'analogy' => 'Like hearing news through a friend of a friend: information can get distorted along the way.',
                    'symbol' => 'CK → A → B (A, B non-key)',
                    'related_terms' => ['3NF', 'Partial dependency', 'Non-key attribute'],
                    'difficulty' => 'intermediate',
                ],
                'pt-BR' => [
                    'name' => 'Dependência Transitiva',
                    'short' => 'DT',
                    'definition' => 'Quando um atributo não chave depende de outro atributo não chave.',
                    'example' => 'Em Funcionário(func_id, depto_id, depto_nome).',
                    'analogy' => 'Como ouvir uma notícia através de um amigo de um amigo.',
                    'symbol' => 'CK → A → B (A, B não chave)',
                    'related_terms' => ['3FN', 'Dependência parcial', 'Atributo não chave'],
                    'difficulty' => 'intermediate',
                ],
            ],
            'Clausura' => [
                'es' => [
                    'name' => 'Clausura (Cierre)',
                    'short' => 'Cl',
                    'definition' => 'El conjunto de todos los atributos que pueden determinarse a partir de un conjunto dado de atributos, utilizando las dependencias funcionales. Se denota como X⁺.',
                    'example' => 'Dado A → B y B → C, la clausura de {A} es {A, B, C} porque A determina B y B determina C.',
                    'analogy' => 'Como una reacción en cadena: al tirar de un hilo (atributo inicial), descubres todo lo que está conectado.',
                    'symbol' => 'X⁺',
                    'related_terms' => ['DF', 'Axiomas de Armstrong', 'Clave candidata'],
                    'difficulty' => 'intermediate',
                ],
                'en' => [
                    'name' => 'Closure',
                    'short' => 'Cl',
                    'definition' => 'The set of all attributes that can be determined from a given set of attributes, using the functional dependencies. Denoted as X⁺.',
                    'example' => 'Given A → B and B → C, the closure of {A} is {A, B, C} because A determines B and B determines C.',
                    'analogy' => 'Like a chain reaction: pulling one thread (initial attribute) reveals everything connected to it.',
                    'symbol' => 'X⁺',
                    'related_terms' => ['FD', 'Armstrong\'s axioms', 'Candidate key'],
                    'difficulty' => 'intermediate',
                ],
                'pt-BR' => [
                    'name' => 'Fecho (Clausura)',
                    'short' => 'Cl',
                    'definition' => 'O conjunto de todos os atributos determinados a partir de um conjunto dado.',
                    'example' => 'Dado A → B e B → C, o fecho de {A} é {A, B, C}.',
                    'analogy' => 'Como uma reação em cadeia.',
                    'symbol' => 'X⁺',
                    'related_terms' => ['DF', 'Axiomas de Armstrong', 'Chave candidata'],
                    'difficulty' => 'intermediate',
                ],
            ],
            'ClaveCandidata' => [
                'es' => [
                    'name' => 'Clave Candidata',
                    'short' => 'CK',
                    'definition' => 'Un conjunto de atributos que identifica unívocamente cada tupla en una relación. Es una superclave minimal: ningún subconjunto propio es superclave.',
                    'example' => 'En una tabla Estudiante, tanto {id_estudiante} como {correo} pueden ser claves candidatas si cada uno identifica de forma única al estudiante.',
                    'analogy' => 'Como tener varias llaves que abren la misma puerta, pero cada una es la más pequeña posible que funciona.',
                    'symbol' => 'CK₁, CK₂, ..., CKₖ',
                    'related_terms' => ['Superclave', 'Clave primaria', 'Atributo primo'],
                    'difficulty' => 'intermediate',
                ],
                'en' => [
                    'name' => 'Candidate Key',
                    'short' => 'CK',
                    'definition' => 'A set of attributes that uniquely identifies each tuple in a relation. It is a minimal superkey: no proper subset is a superkey.',
                    'example' => 'In a Student table, both {student_id} and {email} could be candidate keys if each uniquely identifies the student.',
                    'analogy' => 'Like having several keys that open the same door, each being the smallest possible key that works.',
                    'symbol' => 'CK₁, CK₂, ..., CKₖ',
                    'related_terms' => ['Superkey', 'Primary key', 'Prime attribute'],
                    'difficulty' => 'intermediate',
                ],
                'pt-BR' => [
                    'name' => 'Chave Candidata',
                    'short' => 'CK',
                    'definition' => 'Um conjunto mínimo de atributos que identifica cada tupla de forma única.',
                    'example' => 'Em Aluno, {id_aluno} e {email} podem ser chaves candidatas.',
                    'analogy' => 'Como várias chaves que abrem a mesma porta.',
                    'symbol' => 'CK₁, CK₂, ..., CKₖ',
                    'related_terms' => ['Superchave', 'Chave primária', 'Atributo primo'],
                    'difficulty' => 'intermediate',
                ],
            ],
            'Superclave' => [
                'es' => [
                    'name' => 'Superclave',
                    'short' => 'SK',
                    'definition' => 'Un conjunto de atributos que contiene una clave candidata. Identifica unívocamente cada tupla, pero puede contener atributos redundantes.',
                    'example' => 'Si {id_estudiante} es clave candidata, entonces {id_estudiante, nombre} es una superclave (aunque nombre es redundante para identificación).',
                    'analogy' => 'Como usar nombre completo + dirección + fecha de nacimiento para identificar a una persona: funciona, pero tiene datos innecesarios.',
                    'symbol' => 'SK ⊇ CK',
                    'related_terms' => ['Clave candidata', 'Clave primaria', 'Atributo'],
                    'difficulty' => 'intermediate',
                ],
                'en' => [
                    'name' => 'Superkey',
                    'short' => 'SK',
                    'definition' => 'A set of attributes that contains a candidate key. Uniquely identifies each tuple but may contain redundant attributes.',
                    'example' => 'If {student_id} is a candidate key, then {student_id, name} is a superkey (though name is redundant for identification).',
                    'analogy' => 'Like using full name + address + birth date to identify a person: it works but has unnecessary data.',
                    'symbol' => 'SK ⊇ CK',
                    'related_terms' => ['Candidate key', 'Primary key', 'Attribute'],
                    'difficulty' => 'intermediate',
                ],
                'pt-BR' => [
                    'name' => 'Superchave',
                    'short' => 'SK',
                    'definition' => 'Um conjunto de atributos que contém uma chave candidata.',
                    'example' => 'Se {id_aluno} é chave candidata, {id_aluno, nome} é superchave.',
                    'analogy' => 'Como usar nome completo + endereço.',
                    'symbol' => 'SK ⊇ CK',
                    'related_terms' => ['Chave candidata', 'Chave primária', 'Atributo'],
                    'difficulty' => 'intermediate',
                ],
            ],
            'AtributoPrimo' => [
                'es' => [
                    'name' => 'Atributo Primo',
                    'short' => 'PA',
                    'definition' => 'Un atributo que pertenece a al menos una clave candidata. Los atributos que no pertenecen a ninguna clave candidata se llaman atributos no primos.',
                    'example' => 'En R(A, B, C) con claves candidatas {A} y {B}, los atributos A y B son primos, C es no primo.',
                    'analogy' => 'Como los jugadores titulares de un equipo: los atributos primos son los que están en la alineación principal (clave candidata).',
                    'symbol' => 'PA ∈ CK',
                    'related_terms' => ['Clave candidata', 'Atributo no clave', 'Superclave'],
                    'difficulty' => 'intermediate',
                ],
                'en' => [
                    'name' => 'Prime Attribute',
                    'short' => 'PA',
                    'definition' => 'An attribute that belongs to at least one candidate key. Attributes that do not belong to any candidate key are called non-prime attributes.',
                    'example' => 'In R(A, B, C) with candidate keys {A} and {B}, attributes A and B are prime, C is non-prime.',
                    'analogy' => 'Like starting players on a team: prime attributes are the ones in the main lineup (candidate key).',
                    'symbol' => 'PA ∈ CK',
                    'related_terms' => ['Candidate key', 'Non-key attribute', 'Superkey'],
                    'difficulty' => 'intermediate',
                ],
                'pt-BR' => [
                    'name' => 'Atributo Primo',
                    'short' => 'PA',
                    'definition' => 'Um atributo que pertence a pelo menos uma chave candidata.',
                    'example' => 'Em R(A, B, C) com chaves {A} e {B}, A e B são primos.',
                    'analogy' => 'Como os titulares de um time.',
                    'symbol' => 'PA ∈ CK',
                    'related_terms' => ['Chave candidata', 'Atributo não chave', 'Superchave'],
                    'difficulty' => 'intermediate',
                ],
            ],
            'Descomposicion' => [
                'es' => [
                    'name' => 'Descomposición',
                    'short' => 'Dec',
                    'definition' => 'El proceso de dividir una relación en múltiples relaciones más pequeñas para eliminar redundancias y anomalías. Debe ser sin pérdida y preservar dependencias.',
                    'example' => 'Descomponer R(A, B, C, D) con A → B en R1(A, B) y R2(A, C, D).',
                    'analogy' => 'Como separar una pizza en porciones: cada porción (sub-relación) contiene una parte de la información original, y al juntarlas recuperas la pizza completa.',
                    'symbol' => 'R → {R₁, R₂, ..., Rₖ}',
                    'related_terms' => ['Join sin pérdida', 'Preservación de dependencias', 'Normalización'],
                    'difficulty' => 'intermediate',
                ],
                'en' => [
                    'name' => 'Decomposition',
                    'short' => 'Dec',
                    'definition' => 'The process of dividing a relation into multiple smaller relations to eliminate redundancies and anomalies. Must be lossless and preserve dependencies.',
                    'example' => 'Decompose R(A, B, C, D) with A → B into R1(A, B) and R2(A, C, D).',
                    'analogy' => 'Like separating a pizza into slices: each slice (sub-relation) contains part of the original information, and combining them recovers the whole pizza.',
                    'symbol' => 'R → {R₁, R₂, ..., Rₖ}',
                    'related_terms' => ['Lossless join', 'Dependency preservation', 'Normalization'],
                    'difficulty' => 'intermediate',
                ],
                'pt-BR' => [
                    'name' => 'Decomposição',
                    'short' => 'Dec',
                    'definition' => 'Processo de dividir uma relação em relações menores.',
                    'example' => 'Decompor R(A, B, C, D) em R1(A, B) e R2(A, C, D).',
                    'analogy' => 'Como separar uma pizza em fatias.',
                    'symbol' => 'R → {R₁, R₂, ..., Rₖ}',
                    'related_terms' => ['Join sem perda', 'Preservação de dependências', 'Normalização'],
                    'difficulty' => 'intermediate',
                ],
            ],
            'JoinSinPerdida' => [
                'es' => [
                    'name' => 'Join Sin Pérdida',
                    'short' => 'JSP',
                    'definition' => 'Propiedad de una descomposición: al recombinar las sub-relaciones mediante JOIN, se obtiene exactamente la relación original, sin filas espurias ni pérdida de información.',
                    'example' => 'R1 ⨝ R2 = R (la reunión natural de las sub-relaciones recupera exactamente la relación original).',
                    'analogy' => 'Como un rompecabezas: si las piezas (sub-relaciones) encajan perfectamente, al armarlas obtienes la imagen original sin piezas faltantes ni extras.',
                    'symbol' => 'R = R₁ ⨝ R₂ ⨝ ... ⨝ Rₖ',
                    'related_terms' => ['Descomposición', 'Preservación de dependencias', 'Chase'],
                    'difficulty' => 'intermediate',
                ],
                'en' => [
                    'name' => 'Lossless Join',
                    'short' => 'LJ',
                    'definition' => 'A property of a decomposition: when recombining sub-relations via JOIN, you obtain exactly the original relation, with no spurious rows or information loss.',
                    'example' => 'R1 ⨝ R2 = R (the natural join of sub-relations recovers exactly the original relation).',
                    'analogy' => 'Like a jigsaw puzzle: if the pieces (sub-relations) fit perfectly, assembling them yields the original image with no missing or extra pieces.',
                    'symbol' => 'R = R₁ ⨝ R₂ ⨝ ... ⨝ Rₖ',
                    'related_terms' => ['Decomposition', 'Dependency preservation', 'Chase'],
                    'difficulty' => 'intermediate',
                ],
                'pt-BR' => [
                    'name' => 'Join Sem Perda',
                    'short' => 'JSP',
                    'definition' => 'Propriedade onde a recomposição das sub-relações recupera exatamente a relação original.',
                    'example' => 'R1 ⨝ R2 = R',
                    'analogy' => 'Como um quebra-cabeça.',
                    'symbol' => 'R = R₁ ⨝ R₂ ⨝ ... ⨝ Rₖ',
                    'related_terms' => ['Decomposição', 'Preservação de dependências', 'Chase'],
                    'difficulty' => 'intermediate',
                ],
            ],
            'PreservacionDependencias' => [
                'es' => [
                    'name' => 'Preservación de Dependencias',
                    'short' => 'PD',
                    'definition' => 'Propiedad de una descomposición: todas las dependencias funcionales originales pueden verificarse dentro de las sub-relaciones individuales sin necesidad de hacer JOINs.',
                    'example' => 'Si R tiene A → B y descompones en R1(A, C) y R2(B, C), la dependencia A → B no se puede verificar en ninguna sub-relación individual.',
                    'analogy' => 'Como una receta de cocina: si separas los ingredientes en diferentes cajones, cada cajón debería tener las instrucciones completas para su parte.',
                    'symbol' => '∪π(F) implica todas las FDs de F',
                    'related_terms' => ['Descomposición', 'Join sin pérdida', 'Cobertura mínima'],
                    'difficulty' => 'intermediate',
                ],
                'en' => [
                    'name' => 'Dependency Preservation',
                    'short' => 'DP',
                    'definition' => 'A property of a decomposition: all original functional dependencies can be checked within individual sub-relations without needing JOINs.',
                    'example' => 'If R has A → B and you decompose into R1(A, C) and R2(B, C), the dependency A → B cannot be checked in any individual sub-relation.',
                    'analogy' => 'Like a recipe: if you separate ingredients into different drawers, each drawer should have complete instructions for its part.',
                    'symbol' => '∪π(F) implies all FDs in F',
                    'related_terms' => ['Decomposition', 'Lossless join', 'Canonical cover'],
                    'difficulty' => 'intermediate',
                ],
                'pt-BR' => [
                    'name' => 'Preservação de Dependências',
                    'short' => 'PD',
                    'definition' => 'Propriedade onde todas as dependências originais podem ser verificadas nas sub-relações.',
                    'example' => 'Se R tem A → B e decompõe em R1(A, C) e R2(B, C), A → B não é preservada.',
                    'analogy' => 'Como uma receita de cozinha.',
                    'symbol' => '∪π(F) implica todas as FDs',
                    'related_terms' => ['Decomposição', 'Join sem perda', 'Cobertura mínima'],
                    'difficulty' => 'intermediate',
                ],
            ],
            '4FN' => [
                'es' => [
                    'name' => 'Cuarta Forma Normal',
                    'short' => '4FN',
                    'definition' => 'Una tabla está en 4FN si está en BCNF y no tiene dependencias multivaluadas no triviales. Elimina redundancias causadas por atributos independientes.',
                    'example' => 'NO: ProfesorCursoLibro(prof_id, curso, libro) donde profesor puede dar varios cursos y usar varios libros independientemente.',
                    'analogy' => 'Como separar la lista de canciones favoritas de un amigo de la lista de películas favoritas: son independientes y no deberían estar en la misma tabla.',
                    'symbol' => 'BCNF + sin MVDs no triviales',
                    'related_terms' => ['BCNF', 'Dependencia multivaluada', '5FN'],
                    'difficulty' => 'advanced',
                ],
                'en' => [
                    'name' => 'Fourth Normal Form',
                    'short' => '4NF',
                    'definition' => 'A table is in 4NF if it is in BCNF and has no non-trivial multivalued dependencies. Eliminates redundancies caused by independent attributes.',
                    'example' => 'NOT: ProfessorCourseBook(prof_id, course, book) where a professor can teach multiple courses and use multiple books independently.',
                    'analogy' => 'Like separating a friend\'s favorite songs list from their favorite movies list: they are independent and should not be in the same table.',
                    'symbol' => 'BCNF + no non-trivial MVDs',
                    'related_terms' => ['BCNF', 'Multivalued dependency', '5NF'],
                    'difficulty' => 'advanced',
                ],
                'pt-BR' => [
                    'name' => 'Quarta Forma Normal',
                    'short' => '4FN',
                    'definition' => 'Uma tabela está na 4FN se está na BCNF e não tem dependências multivaloradas.',
                    'example' => 'NÃO: ProfessorCursoLivro(prof_id, curso, livro)',
                    'analogy' => 'Como separar músicas favoritas de filmes favoritos.',
                    'symbol' => 'BCNF + sem MVDs não triviais',
                    'related_terms' => ['BCNF', 'Dependência multivalorada', '5FN'],
                    'difficulty' => 'advanced',
                ],
            ],
            '5FN' => [
                'es' => [
                    'name' => 'Quinta Forma Normal',
                    'short' => '5FN',
                    'definition' => 'Una tabla está en 5FN (o PJNF) si no puede descomponerse sin pérdida en tablas más pequeñas. Toda dependencia de join es implicada por una clave candidata.',
                    'example' => 'NO: ProveedorPiezaProyecto(prov_id, pieza_id, proy_id) con la regla "si un proveedor suministra una pieza Y el proveedor trabaja en un proyecto Y el proyecto usa la pieza, entonces el proveedor suministra esa pieza a ese proyecto".',
                    'analogy' => 'Como un trío musical donde cada combinación de dos miembros funciona bien, pero el trío completo solo funciona si los tres están sincronizados.',
                    'symbol' => '4FN + sin JDs no implicadas por CK',
                    'related_terms' => ['4FN', 'Dependencia de join', 'PJNF'],
                    'difficulty' => 'advanced',
                ],
                'en' => [
                    'name' => 'Fifth Normal Form',
                    'short' => '5NF',
                    'definition' => 'A table is in 5NF (or PJNF) if it cannot be losslessly decomposed into smaller tables. Every join dependency is implied by a candidate key.',
                    'example' => 'NOT: SupplierPartProject(sup_id, part_id, proj_id) with the rule "if a supplier supplies a part AND the supplier works on a project AND the project uses the part, then the supplier supplies that part to that project".',
                    'analogy' => 'Like a musical trio where any two members work well together, but the full trio only works if all three are in sync.',
                    'symbol' => '4NF + no JDs not implied by CK',
                    'related_terms' => ['4NF', 'Join dependency', 'PJNF'],
                    'difficulty' => 'advanced',
                ],
                'pt-BR' => [
                    'name' => 'Quinta Forma Normal',
                    'short' => '5FN',
                    'definition' => 'Uma tabela está na 5FN se não pode ser decomposta sem perda.',
                    'example' => 'NÃO: FornecedorPecaProjeto(forn_id, peca_id, proj_id)',
                    'analogy' => 'Como um trio musical.',
                    'symbol' => '4FN + sem JDs não implicadas por CK',
                    'related_terms' => ['4FN', 'Dependência de join', 'PJNF'],
                    'difficulty' => 'advanced',
                ],
            ],
            'DependenciaMultivaluada' => [
                'es' => [
                    'name' => 'Dependencia Multivaluada',
                    'short' => 'MVD',
                    'definition' => 'Una dependencia donde un atributo determina un conjunto de valores independientes de otro atributo. Se denota X →→ Y. Es la base de la 4FN.',
                    'example' => 'prof_id →→ curso y prof_id →→ libro: un profesor puede tener varios cursos y varios libros, independientemente.',
                    'analogy' => 'Como los pasatiempos de una persona: saber su nombre no te da un solo pasatiempo, sino una lista de ellos, y esa lista es independiente de otras listas.',
                    'symbol' => 'X →→ Y',
                    'related_terms' => ['4FN', 'DF', 'Dependencia de join'],
                    'difficulty' => 'advanced',
                ],
                'en' => [
                    'name' => 'Multivalued Dependency',
                    'short' => 'MVD',
                    'definition' => 'A dependency where an attribute determines a set of independent values of another attribute. Denoted as X →→ Y. It is the basis for 4NF.',
                    'example' => 'prof_id →→ course and prof_id →→ book: a professor can have multiple courses and multiple books, independently.',
                    'analogy' => 'Like a person\'s hobbies: knowing their name does not give you a single hobby, but a list of them, and that list is independent of other lists.',
                    'symbol' => 'X →→ Y',
                    'related_terms' => ['4NF', 'FD', 'Join dependency'],
                    'difficulty' => 'advanced',
                ],
                'pt-BR' => [
                    'name' => 'Dependência Multivalorada',
                    'short' => 'MVD',
                    'definition' => 'Dependência onde um atributo determina um conjunto independente de valores.',
                    'example' => 'prof_id →→ curso',
                    'analogy' => 'Como os hobbies de uma pessoa.',
                    'symbol' => 'X →→ Y',
                    'related_terms' => ['4FN', 'DF', 'Dependência de join'],
                    'difficulty' => 'advanced',
                ],
            ],
            'DependenciaJoin' => [
                'es' => [
                    'name' => 'Dependencia de Join',
                    'short' => 'JD',
                    'definition' => 'Una restricción donde una relación puede descomponerse sin pérdida en proyecciones más pequeñas. Se denota ⨝[R₁, R₂, ..., Rₖ]. Es la base de la 5FN.',
                    'example' => '⨝[{prov_id, pieza_id}, {prov_id, proy_id}, {pieza_id, proy_id}] significa que la relación es igual al join de sus proyecciones.',
                    'analogy' => 'Como un conjunto de datos que puede dividirse en tablas más pequeñas y luego reunirse sin pérdida, como las piezas de un mueble de ensamblaje.',
                    'symbol' => '⨝[R₁, R₂, ..., Rₖ]',
                    'related_terms' => ['5FN', 'Join sin pérdida', 'PJNF'],
                    'difficulty' => 'advanced',
                ],
                'en' => [
                    'name' => 'Join Dependency',
                    'short' => 'JD',
                    'definition' => 'A constraint where a relation can be losslessly decomposed into smaller projections. Denoted as ⨝[R₁, R₂, ..., Rₖ]. It is the basis for 5NF.',
                    'example' => '⨝[{sup_id, part_id}, {sup_id, proj_id}, {part_id, proj_id}] means the relation equals the join of its projections.',
                    'analogy' => 'Like a dataset that can be split into smaller tables and then rejoined without loss, like the pieces of a ready-to-assemble piece of furniture.',
                    'symbol' => '⨝[R₁, R₂, ..., Rₖ]',
                    'related_terms' => ['5NF', 'Lossless join', 'PJNF'],
                    'difficulty' => 'advanced',
                ],
                'pt-BR' => [
                    'name' => 'Dependência de Join',
                    'short' => 'JD',
                    'definition' => 'Uma restrição onde uma relação pode ser decomposta sem perda.',
                    'example' => '⨝[{forn_id, peca_id}, {forn_id, proj_id}]',
                    'analogy' => 'Como um móvel de montar.',
                    'symbol' => '⨝[R₁, R₂, ..., Rₖ]',
                    'related_terms' => ['5FN', 'Join sem perda', 'PJNF'],
                    'difficulty' => 'advanced',
                ],
            ],
            'CoberturaMinima' => [
                'es' => [
                    'name' => 'Cobertura Mínima',
                    'short' => 'Fc',
                    'definition' => 'Un conjunto mínimo equivalente de dependencias funcionales. Cada FD tiene lado derecho único, sin atributos extraños, y no hay FDs redundantes. Es la base para el algoritmo de síntesis de 3FN.',
                    'example' => 'Dado {A → BC, B → C, A → B}, la cobertura mínima es {A → B, B → C} (A → BC se simplifica y B → C es redundante con A → B → C pero se mantiene si no).',
                    'analogy' => 'Como hacer la maleta para un viaje: solo llevas lo esencial, sin duplicados ni cosas innecesarias.',
                    'symbol' => 'Fc = cobertura mínima de F',
                    'related_terms' => ['Síntesis', 'DF', 'Axiomas de Armstrong'],
                    'difficulty' => 'advanced',
                ],
                'en' => [
                    'name' => 'Canonical Cover',
                    'short' => 'Fc',
                    'definition' => 'A minimal equivalent set of functional dependencies. Each FD has a unique right side, no extraneous attributes, and no redundant FDs. It is the basis for the 3NF synthesis algorithm.',
                    'example' => 'Given {A → BC, B → C, A → B}, the canonical cover is {A → B, B → C}.',
                    'analogy' => 'Like packing for a trip: you only take the essentials, no duplicates or unnecessary items.',
                    'symbol' => 'Fc = canonical cover of F',
                    'related_terms' => ['Synthesis', 'FD', 'Armstrong\'s axioms'],
                    'difficulty' => 'advanced',
                ],
                'pt-BR' => [
                    'name' => 'Cobertura Mínima',
                    'short' => 'Fc',
                    'definition' => 'Conjunto mínimo equivalente de dependências funcionais.',
                    'example' => 'Dado {A → BC, B → C, A → B}, a cobertura mínima é {A → B, B → C}.',
                    'analogy' => 'Como fazer a mala para uma viagem.',
                    'symbol' => 'Fc = cobertura mínima de F',
                    'related_terms' => ['Síntese', 'DF', 'Axiomas de Armstrong'],
                    'difficulty' => 'advanced',
                ],
            ],
            'Sintesis' => [
                'es' => [
                    'name' => 'Síntesis',
                    'short' => 'Syn',
                    'definition' => 'Algoritmo para descomponer un conjunto de dependencias funcionales en un esquema en 3FN que preserva dependencias y tiene join sin pérdida.',
                    'example' => 'Dado F = {A → B, B → C}, la síntesis produce: R1(A, B) con A → B y R2(B, C) con B → C.',
                    'analogy' => 'Como organizar un taller: agrupa herramientas relacionadas (atributos) en cajones (tablas) según su función (dependencias).',
                    'symbol' => 'F → {R₁, R₂, ..., Rₖ} en 3FN',
                    'related_terms' => ['Cobertura mínima', '3FN', 'Descomposición'],
                    'difficulty' => 'advanced',
                ],
                'en' => [
                    'name' => 'Synthesis',
                    'short' => 'Syn',
                    'definition' => 'Algorithm to decompose a set of functional dependencies into a 3NF schema that preserves dependencies and has lossless join.',
                    'example' => 'Given F = {A → B, B → C}, synthesis produces: R1(A, B) with A → B and R2(B, C) with B → C.',
                    'analogy' => 'Like organizing a workshop: group related tools (attributes) into drawers (tables) according to their function (dependencies).',
                    'symbol' => 'F → {R₁, R₂, ..., Rₖ} in 3NF',
                    'related_terms' => ['Canonical cover', '3NF', 'Decomposition'],
                    'difficulty' => 'advanced',
                ],
                'pt-BR' => [
                    'name' => 'Síntese',
                    'short' => 'Syn',
                    'definition' => 'Algoritmo para decompor dependências em um esquema 3FN.',
                    'example' => 'Dado F = {A → B, B → C}: R1(A, B) e R2(B, C).',
                    'analogy' => 'Como organizar uma oficina.',
                    'symbol' => 'F → {R₁, R₂, ..., Rₖ} em 3FN',
                    'related_terms' => ['Cobertura mínima', '3FN', 'Decomposição'],
                    'difficulty' => 'advanced',
                ],
            ],
            'AxiomasArmstrong' => [
                'es' => [
                    'name' => 'Axiomas de Armstrong',
                    'short' => 'AA',
                    'definition' => 'Conjunto de reglas de inferencia utilizadas para derivar todas las dependencias funcionales implicadas por un conjunto dado. Incluyen: reflexividad, aumentatividad y transitividad.',
                    'example' => 'Regla de transitividad: Si A → B y B → C, entonces A → C.\nRegla de reflexividad: Si Y ⊆ X, entonces X → Y.\nRegla de aumentatividad: Si X → Y, entonces XZ → YZ.',
                    'analogy' => 'Como las reglas básicas de la aritmética: son los fundamentos sobre los que se construye todo el razonamiento sobre dependencias funcionales.',
                    'symbol' => 'Reflexividad, Aumentatividad, Transitividad',
                    'related_terms' => ['DF', 'Clausura', 'Cobertura mínima'],
                    'difficulty' => 'advanced',
                ],
                'en' => [
                    'name' => 'Armstrong\'s Axioms',
                    'short' => 'AA',
                    'definition' => 'A set of inference rules used to derive all functional dependencies implied by a given set. They include: reflexivity, augmentation, and transitivity.',
                    'example' => 'Transitivity rule: If A → B and B → C, then A → C.\nReflexivity rule: If Y ⊆ X, then X → Y.\nAugmentation rule: If X → Y, then XZ → YZ.',
                    'analogy' => 'Like the basic rules of arithmetic: they are the foundations upon which all reasoning about functional dependencies is built.',
                    'symbol' => 'Reflexivity, Augmentation, Transitivity',
                    'related_terms' => ['FD', 'Closure', 'Canonical cover'],
                    'difficulty' => 'advanced',
                ],
                'pt-BR' => [
                    'name' => 'Axiomas de Armstrong',
                    'short' => 'AA',
                    'definition' => 'Regras de inferência para derivar dependências funcionais.',
                    'example' => 'Transitividade: Se A → B e B → C, então A → C.',
                    'analogy' => 'Como as regras básicas da aritmética.',
                    'symbol' => 'Reflexividade, Aumentatividade, Transitividade',
                    'related_terms' => ['DF', 'Fecho', 'Cobertura mínima'],
                    'difficulty' => 'advanced',
                ],
            ],
            'DescomposicionBCNF' => [
                'es' => [
                    'name' => 'Descomposición BCNF',
                    'short' => 'D-BCNF',
                    'definition' => 'Algoritmo que descompone recursivamente una relación basándose en dependencias funcionales que violan BCNF. Cada paso divide la relación usando la FD violadora.',
                    'example' => 'R(A, B, C) con FDs {AB → C, C → B}. C → B viola BCNF (C no es superclave). R1 = (C, B), R2 = (A, C).',
                    'analogy' => 'Como un proceso de refinamiento: si encuentras una imperfección (FD violadora), separas esa parte en una nueva pieza.',
                    'symbol' => 'R → R₁ ∪ R₂ hasta BCNF',
                    'related_terms' => ['BCNF', 'Descomposición', 'Join sin pérdida'],
                    'difficulty' => 'advanced',
                ],
                'en' => [
                    'name' => 'BCNF Decomposition',
                    'short' => 'BCNF-D',
                    'definition' => 'An algorithm that recursively decomposes a relation based on functional dependencies that violate BCNF. Each step splits the relation using the violating FD.',
                    'example' => 'R(A, B, C) with FDs {AB → C, C → B}. C → B violates BCNF (C is not a superkey). R1 = (C, B), R2 = (A, C).',
                    'analogy' => 'Like a refinement process: if you find an imperfection (violating FD), you separate that part into a new piece.',
                    'symbol' => 'R → R₁ ∪ R₂ until BCNF',
                    'related_terms' => ['BCNF', 'Decomposition', 'Lossless join'],
                    'difficulty' => 'advanced',
                ],
                'pt-BR' => [
                    'name' => 'Decomposição BCNF',
                    'short' => 'D-BCNF',
                    'definition' => 'Algoritmo que decompõe recursivamente uma relação usando FDs que violam BCNF.',
                    'example' => 'R(A, B, C) com AB → C e C → B: R1(C, B), R2(A, C).',
                    'analogy' => 'Como um processo de refinamento.',
                    'symbol' => 'R → R₁ ∪ R₂ até BCNF',
                    'related_terms' => ['BCNF', 'Decomposição', 'Join sem perda'],
                    'difficulty' => 'advanced',
                ],
            ],
            'PJNF' => [
                'es' => [
                    'name' => 'Forma Normal de Proyección-Join',
                    'short' => 'PJNF',
                    'definition' => 'También conocida como 5FN. Una tabla está en PJNF si toda dependencia de join es implicada por una clave candidata. Es la forma normal más restrictiva.',
                    'example' => 'La relación ProveedorPiezaProyecto(sup_id, pieza_id, proy_id) debe verificar que no hay dependencias de join ocultas.',
                    'analogy' => 'Como un código fuente perfectamente modular: cada módulo (sub-relación) es independiente y la combinación de todos reconstruye exactamente el sistema original.',
                    'symbol' => 'PJNF = 5FN',
                    'related_terms' => ['5FN', 'Dependencia de join', '4FN'],
                    'difficulty' => 'advanced',
                ],
                'en' => [
                    'name' => 'Projection-Join Normal Form',
                    'short' => 'PJNF',
                    'definition' => 'Also known as 5NF. A table is in PJNF if every join dependency is implied by a candidate key. It is the most restrictive normal form.',
                    'example' => 'The SupplierPartProject(sup_id, part_id, proj_id) relation must verify that there are no hidden join dependencies.',
                    'analogy' => 'Like perfectly modular source code: each module (sub-relation) is independent and combining them reconstructs the original system exactly.',
                    'symbol' => 'PJNF = 5NF',
                    'related_terms' => ['5NF', 'Join dependency', '4NF'],
                    'difficulty' => 'advanced',
                ],
                'pt-BR' => [
                    'name' => 'Forma Normal Projeção-Join',
                    'short' => 'PJNF',
                    'definition' => 'Também conhecida como 5FN. Toda dependência de join é implicada por uma chave candidata.',
                    'example' => 'FornecedorPeçaProjeto(forn_id, peca_id, proj_id).',
                    'analogy' => 'Como código fonte perfeitamente modular.',
                    'symbol' => 'PJNF = 5FN',
                    'related_terms' => ['5FN', 'Dependência de join', '4FN'],
                    'difficulty' => 'advanced',
                ],
            ],
            'DFAproximada' => [
                'es' => [
                    'name' => 'Dependencia Funcional Aproximada',
                    'short' => '≈FD',
                    'definition' => 'Una dependencia funcional que se cumple para la mayoría de las tuplas, pero no para todas. Se usa en limpieza de datos y análisis de calidad de datos.',
                    'example' => 'código_postal → ciudad se cumple para el 99% de las direcciones, pero puede haber excepciones (códigos postales que cruzan fronteras administrativas).',
                    'analogy' => 'Como la regla "los cisnes son blancos": es cierta para la mayoría, pero existen cisnes negros (excepciones).',
                    'symbol' => 'X ≈→ Y (aproximadamente)',
                    'related_terms' => ['DF', 'Calidad de datos', 'Limpieza de datos'],
                    'difficulty' => 'advanced',
                ],
                'en' => [
                    'name' => 'Approximate Functional Dependency',
                    'short' => '≈FD',
                    'definition' => 'A functional dependency that holds for most tuples, but not all. Used in data cleaning and data quality analysis.',
                    'example' => 'zip_code → city holds for 99% of addresses, but there may be exceptions (zip codes that cross administrative boundaries).',
                    'analogy' => 'Like the rule "swans are white": it is true for most, but there are black swans (exceptions).',
                    'symbol' => 'X ≈→ Y (approximately)',
                    'related_terms' => ['FD', 'Data quality', 'Data cleaning'],
                    'difficulty' => 'advanced',
                ],
                'pt-BR' => [
                    'name' => 'Dependência Funcional Aproximada',
                    'short' => '≈FD',
                    'definition' => 'Uma dependência funcional que vale para a maioria das tuplas.',
                    'example' => 'cep → cidade vale para 99% dos endereços.',
                    'analogy' => 'Como a regra "cisnes são brancos".',
                    'symbol' => 'X ≈→ Y (aproximadamente)',
                    'related_terms' => ['DF', 'Qualidade de dados', 'Limpeza de dados'],
                    'difficulty' => 'advanced',
                ],
            ],
        ];
    }

    public function getTerm(string $key, string $locale = 'es'): ?array
    {
        $locale = $this->normalizeLocale($locale);

        if (!isset($this->terms[$key])) {
            return null;
        }

        if (!isset($this->terms[$key][$locale])) {
            $locale = 'es';
        }

        return $this->terms[$key][$locale];
    }

    public function search(string $query, string $locale = 'es'): array
    {
        $locale = $this->normalizeLocale($locale);
        $query = mb_strtolower(trim($query));

        if (empty($query)) {
            return [];
        }

        $results = [];

        foreach ($this->terms as $key => $locales) {
            if (!isset($locales[$locale])) {
                continue;
            }

            $term = $locales[$locale];

            $searchable = mb_strtolower(
                $term['name'] . ' ' .
                $term['short'] . ' ' .
                $term['definition'] . ' ' .
                $term['example']
            );

            if (str_contains($searchable, $query)) {
                $results[$key] = $term;
            }
        }

        return $results;
    }

    public function getAllTerms(string $locale = 'es'): array
    {
        $locale = $this->normalizeLocale($locale);
        $result = [];

        foreach ($this->terms as $key => $locales) {
            if (isset($locales[$locale])) {
                $result[$key] = $locales[$locale];
            } else {
                $result[$key] = $locales['es'];
            }
        }

        return $result;
    }

    public function getTermsByDifficulty(string $difficulty, string $locale = 'es'): array
    {
        $locale = $this->normalizeLocale($locale);
        $result = [];

        $validDifficulties = ['basic', 'intermediate', 'advanced'];

        if (!in_array($difficulty, $validDifficulties)) {
            return [];
        }

        foreach ($this->terms as $key => $locales) {
            $termLocale = isset($locales[$locale]) ? $locale : 'es';

            if ($locales[$termLocale]['difficulty'] === $difficulty) {
                $result[$key] = $locales[$termLocale];
            }
        }

        return $result;
    }

    public function getRelatedTerms(string $key, string $locale = 'es'): array
    {
        $locale = $this->normalizeLocale($locale);

        $term = $this->getTerm($key, $locale);

        if ($term === null) {
            return [];
        }

        $related = [];

        foreach ($term['related_terms'] as $relatedName) {
            foreach ($this->terms as $termKey => $locales) {
                $termLocale = isset($locales[$locale]) ? $locale : 'es';
                if ($locales[$termLocale]['name'] === $relatedName) {
                    $related[$termKey] = $locales[$termLocale];
                    break;
                }
            }
        }

        return $related;
    }

    private function normalizeLocale(string $locale): string
    {
        $locale = str_replace('-', '-', $locale);

        $supported = ['es', 'en', 'pt-BR'];

        if (in_array($locale, $supported)) {
            return $locale;
        }

        if (str_starts_with($locale, 'en')) {
            return 'en';
        }

        if (str_starts_with($locale, 'pt')) {
            return 'pt-BR';
        }

        return 'es';
    }
}
