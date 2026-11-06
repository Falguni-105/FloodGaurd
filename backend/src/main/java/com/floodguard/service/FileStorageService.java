package com.floodguard.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.PathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

/** Stores incident photos. File names are server-generated UUIDs; the type is checked by content, not by name. */
@Service
public class FileStorageService {
    public static final Pattern SAFE_NAME = Pattern.compile("^[0-9a-f\\-]{36}\\.(jpg|png|webp)$");
    private static final Map<String, String> EXT = Map.of("jpg", "image/jpeg", "png", "image/png", "webp", "image/webp");
    private final Path dir;

    public FileStorageService(@Value("${floodguard.uploads-dir}") String dir) throws IOException {
        this.dir = Paths.get(dir).toAbsolutePath().normalize();
        Files.createDirectories(this.dir);
    }

    /** @return stored file name, or null if no file was supplied */
    public String store(MultipartFile file) {
        if (file == null || file.isEmpty()) return null;
        try (InputStream in = file.getInputStream()) {
            byte[] head = in.readNBytes(12);
            String ext = detect(head);
            if (ext == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image must be JPEG, PNG or WebP");
            String name = UUID.randomUUID() + "." + ext;
            try (InputStream again = file.getInputStream()) {
                Files.copy(again, dir.resolve(name));
            }
            return name;
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not store image");
        }
    }

    public Resource load(String name) {
        if (!SAFE_NAME.matcher(name).matches()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        Path p = dir.resolve(name).normalize();
        if (!p.startsWith(dir) || !Files.exists(p)) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        return new PathResource(p);
    }

    public static String contentTypeOf(String name) {
        return EXT.getOrDefault(name.substring(name.lastIndexOf('.') + 1), "application/octet-stream");
    }

    private static String detect(byte[] h) {
        if (h.length >= 3 && (h[0] & 0xFF) == 0xFF && (h[1] & 0xFF) == 0xD8 && (h[2] & 0xFF) == 0xFF) return "jpg";
        if (h.length >= 8 && (h[0] & 0xFF) == 0x89 && h[1] == 'P' && h[2] == 'N' && h[3] == 'G') return "png";
        if (h.length >= 12 && h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F'
                && h[8] == 'W' && h[9] == 'E' && h[10] == 'B' && h[11] == 'P') return "webp";
        return null;
    }
}
