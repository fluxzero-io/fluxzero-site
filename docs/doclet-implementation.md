# FluxzeroDoclet Implementation Guide

## Project Structure

```
fluxzero-sdk-java/
├── fluxzero-doclet/
│   ├── pom.xml
│   └── src/main/java/io/fluxzero/doclet/
│       ├── FluxzeroDoclet.java
│       ├── processor/
│       │   ├── ClassProcessor.java
│       │   ├── MethodProcessor.java
│       │   ├── AnnotationProcessor.java
│       │   └── JavadocParser.java
│       ├── model/
│       │   ├── ClassInfo.java
│       │   ├── MethodInfo.java
│       │   ├── AnnotationUsage.java
│       │   └── CodeExample.java
│       ├── output/
│       │   ├── JsonGenerator.java
│       │   └── MdxGenerator.java
│       └── util/
│           ├── TypeResolver.java
│           └── FluxzeroPatterns.java
```

## Core Implementation

### 1. Main Doclet Class

```java
package io.fluxzero.doclet;

import jdk.javadoc.doclet.*;
import com.sun.source.doctree.DocTree;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;

import javax.lang.model.element.*;
import javax.lang.model.util.ElementFilter;
import java.io.File;
import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

public class FluxzeroDoclet implements Doclet {
    private Reporter reporter;
    private DocletEnvironment environment;
    private final ObjectMapper objectMapper;

    // Processors
    private final ClassProcessor classProcessor;
    private final JsonGenerator jsonGenerator;

    // Configuration
    private Path outputDirectory = Paths.get("target", "fluxzero-docs");
    private String outputFormat = "json"; // json or mdx

    public FluxzeroDoclet() {
        this.objectMapper = new ObjectMapper()
            .enable(SerializationFeature.INDENT_OUTPUT)
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

        this.classProcessor = new ClassProcessor();
        this.jsonGenerator = new JsonGenerator(objectMapper);
    }

    @Override
    public void init(Locale locale, Reporter reporter) {
        this.reporter = reporter;
        reporter.print(Diagnostic.Kind.NOTE, "FluxzeroDoclet initialized");
    }

    @Override
    public String getName() {
        return "FluxzeroDoclet";
    }

    @Override
    public Set<? extends Option> getSupportedOptions() {
        return Set.of(
            new SimpleOption("-outputdir", 1, "Output directory", this::setOutputDirectory),
            new SimpleOption("-outputformat", 1, "Output format (json|mdx)", this::setOutputFormat)
        );
    }

    @Override
    public SourceVersion getSupportedSourceVersion() {
        return SourceVersion.latest();
    }

    @Override
    public boolean run(DocletEnvironment environment) {
        this.environment = environment;

        try {
            // Get all included elements
            Set<Element> includedElements = environment.getIncludedElements();

            // Filter for type elements (classes, interfaces, annotations, enums)
            Set<TypeElement> typeElements = ElementFilter.typesIn(includedElements);

            // Filter for Fluxzero packages only
            Set<TypeElement> fluxzeroTypes = typeElements.stream()
                .filter(this::isFluxzeroType)
                .collect(Collectors.toSet());

            reporter.print(Diagnostic.Kind.NOTE,
                String.format("Processing %d Fluxzero types", fluxzeroTypes.size()));

            // Process all types
            Map<String, Object> documentationData = processTypes(fluxzeroTypes);

            // Generate output
            if ("json".equals(outputFormat)) {
                jsonGenerator.generate(documentationData, outputDirectory);
            } else {
                // Future: MdxGenerator implementation
                reporter.print(Diagnostic.Kind.WARNING, "MDX output not yet implemented");
            }

            reporter.print(Diagnostic.Kind.NOTE,
                String.format("Documentation generated in %s", outputDirectory));

            return true;

        } catch (Exception e) {
            reporter.print(Diagnostic.Kind.ERROR,
                String.format("Failed to generate documentation: %s", e.getMessage()));
            e.printStackTrace();
            return false;
        }
    }

    private boolean isFluxzeroType(TypeElement element) {
        String packageName = environment.getElementUtils()
            .getPackageOf(element).getQualifiedName().toString();
        return packageName.startsWith("io.fluxzero");
    }

    private Map<String, Object> processTypes(Set<TypeElement> typeElements) {
        Map<String, Object> result = new HashMap<>();

        // Metadata
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("version", "1.0.0");
        metadata.put("timestamp", Instant.now().toString());
        metadata.put("javaVersion", System.getProperty("java.version"));
        result.put("metadata", metadata);

        // Process packages and classes
        Map<String, Object> packages = new HashMap<>();
        Map<String, Object> index = new HashMap<>();

        // Group by package
        Map<String, List<TypeElement>> packageMap = typeElements.stream()
            .collect(Collectors.groupingBy(element ->
                environment.getElementUtils().getPackageOf(element)
                    .getQualifiedName().toString()));

        List<String> allAnnotations = new ArrayList<>();
        List<String> handlerAnnotations = new ArrayList<>();
        List<String> webAnnotations = new ArrayList<>();

        for (Map.Entry<String, List<TypeElement>> entry : packageMap.entrySet()) {
            String packageName = entry.getKey();
            List<TypeElement> packageTypes = entry.getValue();

            Map<String, Object> packageInfo = new HashMap<>();
            packageInfo.put("name", packageName);
            packageInfo.put("description", getPackageDescription(packageName));

            Map<String, Object> classes = new HashMap<>();

            for (TypeElement typeElement : packageTypes) {
                Map<String, Object> classInfo = classProcessor.process(typeElement, environment);
                classes.put(typeElement.getSimpleName().toString(), classInfo);

                // Update indices
                if ("annotation".equals(classInfo.get("type"))) {
                    String simpleName = typeElement.getSimpleName().toString();
                    allAnnotations.add(simpleName);

                    if (simpleName.startsWith("Handle")) {
                        if (packageName.contains(".web")) {
                            webAnnotations.add(simpleName);
                        } else {
                            handlerAnnotations.add(simpleName);
                        }
                    }
                }
            }

            packageInfo.put("classes", classes);
            packages.put(packageName, packageInfo);
        }

        // Build index
        index.put("annotations", allAnnotations);
        index.put("handlerAnnotations", handlerAnnotations);
        index.put("webAnnotations", webAnnotations);

        result.put("packages", packages);
        result.put("index", index);

        return result;
    }

    private String getPackageDescription(String packageName) {
        // Map package names to descriptions
        Map<String, String> descriptions = Map.of(
            "io.fluxzero.sdk.tracking.handling", "Core handler annotations and infrastructure",
            "io.fluxzero.sdk.web", "Web request handling annotations and utilities",
            "io.fluxzero.sdk.modeling", "Domain modeling and aggregate support",
            "io.fluxzero.sdk.publishing", "Message publishing and gateway infrastructure",
            "io.fluxzero.sdk.scheduling", "Scheduled message handling"
        );

        return descriptions.getOrDefault(packageName, "Fluxzero SDK components");
    }

    private void setOutputDirectory(List<String> args) {
        if (!args.isEmpty()) {
            outputDirectory = Paths.get(args.get(0));
        }
    }

    private void setOutputFormat(List<String> args) {
        if (!args.isEmpty()) {
            outputFormat = args.get(0).toLowerCase();
        }
    }

    // Simple option implementation
    private static class SimpleOption implements Option {
        private final String name;
        private final int argCount;
        private final String description;
        private final java.util.function.Consumer<List<String>> processor;

        public SimpleOption(String name, int argCount, String description,
                           java.util.function.Consumer<List<String>> processor) {
            this.name = name;
            this.argCount = argCount;
            this.description = description;
            this.processor = processor;
        }

        @Override
        public int getArgumentCount() { return argCount; }

        @Override
        public String getDescription() { return description; }

        @Override
        public Kind getKind() { return Kind.STANDARD; }

        @Override
        public List<String> getNames() { return List.of(name); }

        @Override
        public String getParameters() { return argCount > 0 ? "<path>" : ""; }

        @Override
        public boolean process(String option, List<String> arguments) {
            processor.accept(arguments);
            return true;
        }
    }
}
```

### 2. ClassProcessor Implementation

```java
package io.fluxzero.doclet.processor;

import jdk.javadoc.doclet.DocletEnvironment;
import com.sun.source.doctree.*;

import javax.lang.model.element.*;
import javax.lang.model.type.TypeMirror;
import java.util.*;
import java.util.stream.Collectors;

public class ClassProcessor {
    private final MethodProcessor methodProcessor;
    private final AnnotationProcessor annotationProcessor;
    private final JavadocParser javadocParser;

    public ClassProcessor() {
        this.methodProcessor = new MethodProcessor();
        this.annotationProcessor = new AnnotationProcessor();
        this.javadocParser = new JavadocParser();
    }

    public Map<String, Object> process(TypeElement element, DocletEnvironment environment) {
        Map<String, Object> classInfo = new HashMap<>();

        // Basic information
        classInfo.put("type", getElementType(element));
        classInfo.put("fullName", element.getQualifiedName().toString());
        classInfo.put("simpleName", element.getSimpleName().toString());
        classInfo.put("package", environment.getElementUtils()
            .getPackageOf(element).getQualifiedName().toString());

        // Modifiers
        classInfo.put("modifiers", element.getModifiers().stream()
            .map(Modifier::toString).collect(Collectors.toList()));

        // Javadoc
        String docComment = environment.getElementUtils().getDocComment(element);
        if (docComment != null) {
            Map<String, Object> javadocInfo = javadocParser.parse(docComment);
            classInfo.put("description", javadocInfo.get("description"));
            classInfo.put("since", javadocInfo.get("since"));
            classInfo.put("author", javadocInfo.get("author"));
            classInfo.put("examples", javadocInfo.get("examples"));
            classInfo.put("seeAlso", javadocInfo.get("seeAlso"));
        }

        // Inheritance
        TypeMirror superclass = element.getSuperclass();
        if (superclass != null && !superclass.toString().equals("java.lang.Object")) {
            classInfo.put("superclass", superclass.toString());
        }

        List<? extends TypeMirror> interfaces = element.getInterfaces();
        if (!interfaces.isEmpty()) {
            classInfo.put("interfaces", interfaces.stream()
                .map(TypeMirror::toString).collect(Collectors.toList()));
        }

        // Annotations
        List<Map<String, Object>> annotations = annotationProcessor.process(element, environment);
        if (!annotations.isEmpty()) {
            classInfo.put("annotations", annotations);
        }

        // Fluxzero categorization
        classInfo.put("fluxzeroCategory", categorizeFluxzeroClass(element));

        // Members
        List<ExecutableElement> methods = element.getEnclosedElements().stream()
            .filter(ExecutableElement.class::isInstance)
            .map(ExecutableElement.class::cast)
            .filter(e -> e.getKind() == ElementKind.METHOD)
            .collect(Collectors.toList());

        if (!methods.isEmpty()) {
            classInfo.put("methods", methods.stream()
                .map(method -> methodProcessor.process(method, environment))
                .collect(Collectors.toList()));
        }

        // Fields (for enums, constants, etc.)
        List<VariableElement> fields = element.getEnclosedElements().stream()
            .filter(VariableElement.class::isInstance)
            .map(VariableElement.class::cast)
            .filter(e -> e.getKind() == ElementKind.FIELD || e.getKind() == ElementKind.ENUM_CONSTANT)
            .collect(Collectors.toList());

        if (!fields.isEmpty()) {
            classInfo.put("fields", fields.stream()
                .map(field -> processField(field, environment))
                .collect(Collectors.toList()));
        }

        // Constructors
        List<ExecutableElement> constructors = element.getEnclosedElements().stream()
            .filter(ExecutableElement.class::isInstance)
            .map(ExecutableElement.class::cast)
            .filter(e -> e.getKind() == ElementKind.CONSTRUCTOR)
            .collect(Collectors.toList());

        if (!constructors.isEmpty()) {
            classInfo.put("constructors", constructors.stream()
                .map(ctor -> methodProcessor.processConstructor(ctor, environment))
                .collect(Collectors.toList()));
        }

        return classInfo;
    }

    private String getElementType(TypeElement element) {
        switch (element.getKind()) {
            case CLASS: return "class";
            case INTERFACE: return "interface";
            case ANNOTATION_TYPE: return "annotation";
            case ENUM: return "enum";
            case RECORD: return "record";
            default: return "unknown";
        }
    }

    private String categorizeFluxzeroClass(TypeElement element) {
        String packageName = element.getQualifiedName().toString();
        String simpleName = element.getSimpleName().toString();

        if (packageName.contains(".handling") && simpleName.startsWith("Handle")) {
            return "handler";
        } else if (packageName.contains(".web")) {
            return "web";
        } else if (packageName.contains(".modeling")) {
            return "modeling";
        } else if (packageName.contains(".publishing")) {
            return "publishing";
        } else if (packageName.contains(".scheduling")) {
            return "scheduling";
        }

        return "common";
    }

    private Map<String, Object> processField(VariableElement field, DocletEnvironment environment) {
        Map<String, Object> fieldInfo = new HashMap<>();

        fieldInfo.put("name", field.getSimpleName().toString());
        fieldInfo.put("type", processType(field.asType()));
        fieldInfo.put("modifiers", field.getModifiers().stream()
            .map(Modifier::toString).collect(Collectors.toList()));

        // Javadoc
        String docComment = environment.getElementUtils().getDocComment(field);
        if (docComment != null) {
            Map<String, Object> javadocInfo = javadocParser.parse(docComment);
            fieldInfo.put("description", javadocInfo.get("description"));
        }

        // Constant value for enums and static finals
        Object constantValue = field.getConstantValue();
        if (constantValue != null) {
            fieldInfo.put("defaultValue", constantValue.toString());
        }

        return fieldInfo;
    }

    private Map<String, Object> processType(TypeMirror type) {
        Map<String, Object> typeInfo = new HashMap<>();

        String typeName = type.toString();
        typeInfo.put("name", getSimpleTypeName(typeName));
        typeInfo.put("fullName", typeName);
        typeInfo.put("isPrimitive", type.getKind().isPrimitive());

        // Array detection
        if (typeName.contains("[]")) {
            typeInfo.put("isArray", true);
            typeInfo.put("arrayDimensions", countArrayDimensions(typeName));
        }

        // Generic detection
        if (typeName.contains("<")) {
            typeInfo.put("isGeneric", true);
            // TODO: Parse generic parameters
        }

        return typeInfo;
    }

    private String getSimpleTypeName(String fullName) {
        if (fullName.contains(".")) {
            return fullName.substring(fullName.lastIndexOf('.') + 1);
        }
        return fullName;
    }

    private int countArrayDimensions(String typeName) {
        int count = 0;
        int index = 0;
        while ((index = typeName.indexOf("[]", index)) != -1) {
            count++;
            index += 2;
        }
        return count;
    }
}
```

### 3. JsonGenerator Implementation

```java
package io.fluxzero.doclet.output;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

public class JsonGenerator {
    private final ObjectMapper objectMapper;

    public JsonGenerator(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void generate(Map<String, Object> documentationData, Path outputDirectory) throws IOException {
        // Ensure output directory exists
        Files.createDirectories(outputDirectory);

        // Write main documentation file
        Path mainFile = outputDirectory.resolve("fluxzero-api.json");
        objectMapper.writeValue(mainFile.toFile(), documentationData);

        // Optional: Generate separate files per package
        @SuppressWarnings("unchecked")
        Map<String, Object> packages = (Map<String, Object>) documentationData.get("packages");

        if (packages != null) {
            Path packagesDir = outputDirectory.resolve("packages");
            Files.createDirectories(packagesDir);

            for (Map.Entry<String, Object> entry : packages.entrySet()) {
                String packageName = entry.getKey();
                Object packageData = entry.getValue();

                String fileName = packageName.replace('.', '-') + ".json";
                Path packageFile = packagesDir.resolve(fileName);
                objectMapper.writeValue(packageFile.toFile(), packageData);
            }
        }
    }
}
```

## Maven Configuration

### fluxzero-doclet/pom.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>io.fluxzero</groupId>
        <artifactId>fluxzero-sdk-java</artifactId>
        <version>0-SNAPSHOT</version>
    </parent>

    <artifactId>fluxzero-doclet</artifactId>
    <name>Fluxzero Documentation Doclet</name>
    <description>Custom Javadoc doclet for generating JSON documentation</description>

    <dependencies>
        <dependency>
            <groupId>com.fasterxml.jackson.core</groupId>
            <artifactId>jackson-databind</artifactId>
        </dependency>

        <!-- Test dependencies -->
        <dependency>
            <groupId>org.junit.jupiter</groupId>
            <artifactId>junit-jupiter</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <configuration>
                    <release>21</release>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
```

### Integration in Main POM

Add to main `fluxzero-sdk-java/pom.xml`:

```xml
<modules>
    <module>fluxzero-bom</module>
    <module>common</module>
    <module>sdk</module>
    <module>test-server</module>
    <module>proxy</module>
    <module>fluxzero-doclet</module> <!-- Add this -->
</modules>
```

Add new profile for custom doclet:

```xml
<profile>
    <id>fluxzero-docs</id>
    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-javadoc-plugin</artifactId>
                <executions>
                    <execution>
                        <id>fluxzero-json-docs</id>
                        <phase>prepare-package</phase>
                        <goals>
                            <goal>javadoc</goal>
                        </goals>
                        <configuration>
                            <doclet>io.fluxzero.doclet.FluxzeroDoclet</doclet>
                            <docletArtifact>
                                <groupId>io.fluxzero</groupId>
                                <artifactId>fluxzero-doclet</artifactId>
                                <version>${project.version}</version>
                            </docletArtifact>
                            <additionalOptions>
                                <additionalOption>-outputdir</additionalOption>
                                <additionalOption>${project.build.directory}/fluxzero-docs</additionalOption>
                                <additionalOption>-outputformat</additionalOption>
                                <additionalOption>json</additionalOption>
                            </additionalOptions>
                            <sourcepath>${project.basedir}/sdk/src/main/java</sourcepath>
                            <subpackages>io.fluxzero</subpackages>
                        </configuration>
                    </execution>
                </executions>
            </plugin>
        </plugins>
    </build>
</profile>
```

## Usage

```bash
# Build the doclet first
cd fluxzero-sdk-java
mvn clean compile -pl fluxzero-doclet

# Generate JSON documentation
mvn javadoc:javadoc -Pfluxzero-docs

# Output will be in target/fluxzero-docs/
ls target/fluxzero-docs/
# fluxzero-api.json
# packages/io-fluxzero-sdk-tracking-handling.json
# packages/io-fluxzero-sdk-web.json
# etc.
```

## Key Features

1. **Modern Doclet API**: Uses `jdk.javadoc.doclet` (JDK 9+)
2. **JSON Output**: Structured, searchable documentation
3. **Fluxzero-Aware**: Understands handler patterns and web annotations
4. **Extensible**: Easy to add MDX generation, cross-references, etc.
5. **Maven Integration**: Runs as part of standard build process
6. **Configurable**: Output directory and format options

## Next Steps

1. Implement remaining processor classes
2. Add comprehensive Javadoc parsing
3. Create MDX output option
4. Add cross-reference analysis
5. Integrate with documentation site